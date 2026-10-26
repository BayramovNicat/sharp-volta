import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Server } from 'bun';
import { MattermostAPI } from './api';
import type { WebSocketMessage } from './types';
import { MattermostWebSocketClient } from './websocket';

const PORT = Number.parseInt(process.env.PORT || '3000', 10);
const TOPIC_CHAT = 'mattermost_chat';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

function getBrowserDir(): string {
  if (process.env.BROWSER_DIR) return process.env.BROWSER_DIR;
  const localBrowser = path.join(import.meta.dir, 'browser');
  if (existsSync(localBrowser)) return localBrowser;
  const distBrowser = path.join(import.meta.dir, '../dist/browser');
  if (existsSync(distBrowser)) return distBrowser;
  const rootPublic = path.join(import.meta.dir, '../public');
  return rootPublic;
}

export function startServerWithFallback(
  options: Parameters<typeof Bun.serve>[0],
  maxAttempts = 20
): Server<unknown> {
  const initialPort = Number(options.port) || 3000;
  if (initialPort === 0) return Bun.serve(options);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const currentPort = initialPort + attempt;
    try {
      return Bun.serve({ ...options, port: currentPort } as Parameters<typeof Bun.serve>[0]);
    } catch (err: unknown) {
      const inUse =
        err instanceof Error &&
        (('code' in err && (err as { code: string }).code === 'EADDRINUSE') ||
          err.message.includes('in use') ||
          err.message.includes('Failed to start server'));
      if (!inUse || attempt === maxAttempts - 1) throw err;
      console.warn(`[Server] Port ${currentPort} is in use, trying ${currentPort + 1}...`);
    }
  }
  throw new Error(
    `Could not find an available port after ${maxAttempts} attempts starting from ${initialPort}`
  );
}

export function startServer(port = PORT): Server<unknown> {
  const api = new MattermostAPI();
  let serverInstance: Server<unknown> | null = null;

  const mmWs = new MattermostWebSocketClient((event: WebSocketMessage) => {
    if (serverInstance) {
      serverInstance.publish(TOPIC_CHAT, JSON.stringify(event));
    }
  });
  mmWs.connect();

  const browserDir = getBrowserDir();

  serverInstance = startServerWithFallback({
    port,
    async fetch(req, server) {
      const url = new URL(req.url);

      if (url.pathname === '/ws') {
        const success = server.upgrade(req, { data: undefined });
        if (success) return undefined;
        return new Response('WebSocket upgrade failed', { status: 400 });
      }

      if (url.pathname === '/api/me') {
        try {
          const me = await api.getMe();
          return Response.json(me);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 500 });
        }
      }

      if (url.pathname === '/api/teams') {
        try {
          const teams = await api.getMyTeams();
          return Response.json(teams);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 500 });
        }
      }

      if (url.pathname === '/api/statuses') {
        try {
          const userIds = (url.searchParams.get('ids') || '').split(',').filter(Boolean);
          const statuses = await api.getUserStatuses(userIds);
          return Response.json(statuses);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 500 });
        }
      }

      if (url.pathname === '/api/channels') {
        try {
          const me = (await api.getMe()) as { id: string };
          const teams = await api.getMyTeams();
          if (teams.length === 0) return Response.json([]);

          const channels = (await api.getChannelsForTeam(teams[0].id)) as Array<
            Record<string, unknown> & { id: string; name: string; type: string; last_post_at?: number; otherUserId?: string; otherUser?: unknown }
          >;

          const otherUserIds: string[] = [];
          for (const ch of channels) {
            if (ch.type === 'D') {
              const parts = (ch.name as string).split('__');
              const otherId = parts.find((id) => id !== me.id) || me.id;
              ch.otherUserId = otherId;
              otherUserIds.push(otherId);
            }
          }

          if (otherUserIds.length > 0) {
            try {
              const uniqueIds = [...new Set(otherUserIds)];
              await api.getUsersByIds(uniqueIds);
              const statuses = await api.getUserStatuses(uniqueIds);

              for (const ch of channels) {
                if (ch.otherUserId) {
                  const u = await api.getUser(ch.otherUserId);
                  ch.otherUser = {
                    id: u.id,
                    username: u.username,
                    display_name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username,
                    email: u.email,
                    status: statuses[ch.otherUserId] || 'offline',
                  };
                }
              }
            } catch (e) {
              console.error('Failed to batch fetch users:', e);
            }
          }

          channels.sort((a, b) => (b.last_post_at || 0) - (a.last_post_at || 0));
          return Response.json(channels);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 500 });
        }
      }

      const postsMatch = url.pathname.match(/^\/api\/channels\/([^/]+)\/posts$/);
      if (postsMatch) {
        const channelId = postsMatch[1];
        if (req.method === 'GET') {
          try {
            const before = url.searchParams.get('before') || '';
            const after = url.searchParams.get('after') || '';
            const page = url.searchParams.get('page') || '0';
            const perPage = url.searchParams.get('per_page') || '30';

            const postsData = await api.getChannelPosts(channelId, {
              before,
              after,
              page,
              perPage,
            });

            const userIds = new Set<string>();
            if (postsData.posts) {
              for (const pid of Object.keys(postsData.posts)) {
                if (postsData.posts[pid].user_id) {
                  userIds.add(postsData.posts[pid].user_id);
                }
              }
            }

            const users: Record<string, { id: string; username: string; display_name: string }> = {};
            if (userIds.size > 0) {
              try {
                const userList = await api.getUsersByIds([...userIds]);
                for (const u of userList) {
                  users[u.id] = {
                    id: u.id,
                    username: u.username,
                    display_name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username,
                  };
                }
              } catch (e) {
                console.error('Failed to fetch users for posts:', e);
              }
            }

            return Response.json({ ...postsData, users });
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return Response.json({ error: message }, { status: 500 });
          }
        }
        if (req.method === 'POST') {
          try {
            const body = (await req.json()) as { message: string; root_id?: string; file_ids?: string[] };
            const post = await api.createPost(channelId, body.message, body.root_id || '', body.file_ids || []);
            return Response.json(post);
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return Response.json({ error: message }, { status: 500 });
          }
        }
      }

      if (url.pathname === '/api/files' && req.method === 'POST') {
        try {
          const formData = await req.formData();
          const data = await api.uploadFiles(formData);
          return Response.json(data);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          return Response.json({ error: message }, { status: 500 });
        }
      }

      const fileMatch = url.pathname.match(/^\/api\/files\/([^/]+)$/);
      if (fileMatch) {
        try {
          const fileId = fileMatch[1];
          const res = await api.getFile(fileId);
          return new Response(res.body, {
            headers: {
              'Content-Type': res.headers.get('content-type') || 'application/octet-stream',
              'Cache-Control': 'public, max-age=86400, immutable',
            },
          });
        } catch {
          return new Response('File not found', { status: 404 });
        }
      }

      const previewMatch = url.pathname.match(/^\/api\/files\/([^/]+)\/preview$/);
      if (previewMatch) {
        try {
          const fileId = previewMatch[1];
          const res = await api.getFilePreview(fileId);
          return new Response(res.body, {
            headers: {
              'Content-Type': res.headers.get('content-type') || 'image/jpeg',
              'Cache-Control': 'public, max-age=86400, immutable',
            },
          });
        } catch {
          return new Response('Preview not found', { status: 404 });
        }
      }

      const avatarMatch = url.pathname.match(/^\/api\/users\/([^/]+)\/avatar$/);
      if (avatarMatch) {
        try {
          const userId = avatarMatch[1];
          const res = await api.getUserAvatar(userId);
          return new Response(res.body, {
            headers: {
              'Content-Type': res.headers.get('content-type') || 'image/png',
              'Cache-Control': 'public, max-age=3600',
            },
          });
        } catch {
          return new Response('Avatar not found', { status: 404 });
        }
      }

      if (url.pathname === '/' || url.pathname === '/index.html') {
        const indexHtml = path.join(browserDir, 'index.html');
        const file = Bun.file(indexHtml);
        if (await file.exists()) {
          return new Response(file, {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-cache',
            },
          });
        }
      }

      const cleanPath = url.pathname.replace(/^\/+/, '');
      const filePath = path.join(browserDir, cleanPath);
      const staticFile = Bun.file(filePath);

      if (await staticFile.exists()) {
        const ext = path.extname(cleanPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || staticFile.type || 'application/octet-stream';
        const isHashedAsset = cleanPath.startsWith('assets/');
        return new Response(staticFile, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': isHashedAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
          },
        });
      }

      if (req.headers.get('accept')?.includes('text/html')) {
        const indexHtml = path.join(browserDir, 'index.html');
        const file = Bun.file(indexHtml);
        if (await file.exists()) {
          return new Response(file, {
            headers: {
              'Content-Type': 'text/html; charset=utf-8',
              'Cache-Control': 'no-cache',
            },
          });
        }
      }

      return new Response('Not Found', { status: 404 });
    },

    websocket: {
      open(ws) {
        ws.subscribe(TOPIC_CHAT);
      },
      message() {},
      close(ws) {
        ws.unsubscribe(TOPIC_CHAT);
      },
    },
  });

  return serverInstance;
}

if (import.meta.main) {
  const server = startServer();
  console.log(`\n======================================================`);
  console.log(`🚀 Mattermost Bun Server is running!`);
  console.log(`👉 http://localhost:${server.port}`);
  console.log(`======================================================\n`);
}
