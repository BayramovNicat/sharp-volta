import { getMattermostSession, onSessionChange } from './session';
import type { MattermostSession, PostOptions } from './types';

const userCache = new Map<string, unknown>();
const userStatusCache = new Map<string, string>();

export class MattermostAPI {
  private session: MattermostSession;

  constructor() {
    this.session = getMattermostSession();
    onSessionChange(() => {
      this.refreshSession();
    });
  }

  refreshSession(): void {
    this.session = getMattermostSession();
  }

  get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.session.token}`,
      'X-CSRF-Token': this.session.csrfToken || '',
      'Content-Type': 'application/json',
    };
  }

  async request<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.session.baseUrl}/api/v4${endpoint}`;
    let res = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...((options.headers as Record<string, string>) || {}),
      },
    });

    if (res.status === 401) {
      console.warn('[API] Received 401, forcing session reload from disk...');
      this.session = getMattermostSession(true);
      res = await fetch(url, {
        ...options,
        headers: {
          ...this.headers,
          ...((options.headers as Record<string, string>) || {}),
        },
      });
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Mattermost API Error (${res.status}) on ${endpoint}: ${err}`);
    }

    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      return (await res.json()) as T;
    }
    return res as unknown as T;
  }

  async getMe(): Promise<unknown> {
    return this.request('/users/me');
  }

  async getMyTeams(): Promise<Array<{ id: string; name: string; display_name: string }>> {
    return this.request('/users/me/teams');
  }

  async getChannelsForTeam(
    teamId: string
  ): Promise<Array<Record<string, unknown>>> {
    return this.request(`/users/me/teams/${teamId}/channels`);
  }

  async getChannelPosts(
    channelId: string,
    options: PostOptions = {}
  ): Promise<{ posts?: Record<string, { user_id: string }>; order?: string[] }> {
    const { page = 0, perPage = 30, before = '', after = '' } = options;
    let query = `per_page=${perPage}`;
    if (before) query += `&before=${encodeURIComponent(before)}`;
    else if (after) query += `&after=${encodeURIComponent(after)}`;
    else query += `&page=${encodeURIComponent(page)}`;
    return this.request(`/channels/${channelId}/posts?${query}`);
  }

  async createPost(
    channelId: string,
    message: string,
    rootId = '',
    fileIds: string[] = []
  ): Promise<unknown> {
    const payload: {
      channel_id: string;
      message: string;
      root_id: string;
      file_ids?: string[];
    } = {
      channel_id: channelId,
      message,
      root_id: rootId,
    };
    if (fileIds && fileIds.length > 0) {
      payload.file_ids = fileIds;
    }
    return this.request('/posts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getUser(userId: string): Promise<{ id: string; username: string; first_name?: string; last_name?: string; email?: string }> {
    if (userCache.has(userId)) {
      return userCache.get(userId) as { id: string; username: string; first_name?: string; last_name?: string; email?: string };
    }
    const user = await this.request<{ id: string; username: string; first_name?: string; last_name?: string; email?: string }>(`/users/${userId}`);
    userCache.set(userId, user);
    return user;
  }

  async getUsersByIds(
    userIds: string[]
  ): Promise<Array<{ id: string; username: string; first_name?: string; last_name?: string; email?: string }>> {
    const needed = userIds.filter((id) => !userCache.has(id));
    if (needed.length > 0) {
      try {
        const users = await this.request<Array<{ id: string; username: string; first_name?: string; last_name?: string; email?: string }>>('/users/ids', {
          method: 'POST',
          body: JSON.stringify(needed),
        });
        for (const u of users) {
          userCache.set(u.id, u);
        }
      } catch (err) {
        console.error('[API] Failed to batch fetch users:', err);
      }
    }
    return userIds
      .map((id) => userCache.get(id) as { id: string; username: string; first_name?: string; last_name?: string; email?: string })
      .filter(Boolean);
  }

  async getUserStatuses(userIds: string[]): Promise<Record<string, string>> {
    if (!userIds || userIds.length === 0) return {};
    try {
      const statuses = await this.request<Array<{ user_id: string; status: string }>>(
        '/users/status/ids',
        {
          method: 'POST',
          body: JSON.stringify(userIds),
        }
      );
      const res: Record<string, string> = {};
      for (const s of statuses) {
        userStatusCache.set(s.user_id, s.status);
        res[s.user_id] = s.status;
      }
      return res;
    } catch {
      return {};
    }
  }

  getCachedStatus(userId: string): string {
    return userStatusCache.get(userId) || 'offline';
  }

  async getFile(fileId: string): Promise<Response> {
    const url = `${this.session.baseUrl}/api/v4/files/${fileId}`;
    return fetch(url, {
      headers: { Authorization: `Bearer ${this.session.token}` },
    });
  }

  async getFilePreview(fileId: string): Promise<Response> {
    const url = `${this.session.baseUrl}/api/v4/files/${fileId}/preview`;
    return fetch(url, {
      headers: { Authorization: `Bearer ${this.session.token}` },
    });
  }

  async getUserAvatar(userId: string): Promise<Response> {
    const url = `${this.session.baseUrl}/api/v4/users/${userId}/image`;
    return fetch(url, {
      headers: { Authorization: `Bearer ${this.session.token}` },
    });
  }

  async uploadFiles(formData: FormData): Promise<unknown> {
    const url = `${this.session.baseUrl}/api/v4/files`;
    let res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.session.token}`,
        'X-CSRF-Token': this.session.csrfToken || '',
      },
      body: formData,
    });

    if (res.status === 401) {
      console.warn('[API] Received 401 on upload, forcing session reload...');
      this.session = getMattermostSession(true);
      res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.session.token}`,
          'X-CSRF-Token': this.session.csrfToken || '',
        },
        body: formData,
      });
    }

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Mattermost API Error (${res.status}) on /files: ${err}`);
    }

    return res.json();
  }
}
