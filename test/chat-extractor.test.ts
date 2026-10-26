import { describe, expect, it } from 'bun:test';
import type { Channel, Post, User } from '../src/types';
import { extractChatData, extractMessageText } from '../src/utils/chat-extractor';

describe('chat extractor service', () => {
  const mockChannel: Channel = {
    id: 'ch-test-123',
    name: 'project-launch',
    display_name: 'Project Launch',
    type: 'O',
    header: 'Launch tasks and deliverables',
    purpose: 'Coordination channel for launch',
  };

  const usersMap = new Map<string, User>([
    [
      'user-1',
      {
        id: 'user-1',
        username: 'alice',
        display_name: 'Alice Johnson',
      },
    ],
    [
      'user-2',
      {
        id: 'user-2',
        username: 'bob',
        display_name: 'Bob Smith',
      },
    ],
  ]);

  it('extracts exactly the loaded count (e.g. 40 if 40 loaded, 1000 if 1000 loaded)', () => {
    const fortyPosts: Post[] = Array.from({ length: 40 }, (_, i) => ({
      id: `post-40-${i}`,
      user_id: i % 2 === 0 ? 'user-1' : 'user-2',
      channel_id: mockChannel.id,
      message: `Message #${i}`,
      create_at: 1700000000000 + i * 1000,
    }));

    const result40 = extractChatData(mockChannel, fortyPosts, usersMap, 'user-1');
    expect(result40.messages.length).toBe(40);
    expect(result40.stats.totalLoadedMessages).toBe(40);

    const thousandPosts: Post[] = Array.from({ length: 1000 }, (_, i) => ({
      id: `post-1000-${i}`,
      user_id: 'user-1',
      channel_id: mockChannel.id,
      message: `Batch message ${i}`,
      create_at: 1700000000000 + i * 100,
    }));

    const result1000 = extractChatData(mockChannel, thousandPosts, usersMap, 'user-1');
    expect(result1000.messages.length).toBe(1000);
    expect(result1000.stats.totalLoadedMessages).toBe(1000);
  });

  it('sorts messages in chronological order (oldest to newest)', () => {
    const unorderedPosts: Post[] = [
      {
        id: 'p3',
        user_id: 'user-1',
        channel_id: mockChannel.id,
        message: 'Third',
        create_at: 300,
      },
      {
        id: 'p1',
        user_id: 'user-1',
        channel_id: mockChannel.id,
        message: 'First',
        create_at: 100,
      },
      {
        id: 'p2',
        user_id: 'user-2',
        channel_id: mockChannel.id,
        message: 'Second',
        create_at: 200,
      },
    ];

    const result = extractChatData(mockChannel, unorderedPosts, usersMap, 'user-1');
    expect(result.messages.map((m) => m.id)).toEqual(['p1', 'p2', 'p3']);
    expect(result.messages.map((m) => m.text)).toEqual(['First', 'Second', 'Third']);
  });

  it('provides media links with full URLs for both metadata.files and file_ids', () => {
    const postsWithMedia: Post[] = [
      {
        id: 'post-files',
        user_id: 'user-1',
        channel_id: mockChannel.id,
        message: 'Check these specifications and screenshots',
        create_at: 1000,
        metadata: {
          files: [
            {
              id: 'file-doc-1',
              name: 'spec.pdf',
              extension: 'pdf',
              size: 204800,
              mime_type: 'application/pdf',
            },
            {
              id: 'file-img-2',
              name: 'mockup.png',
              extension: 'png',
              size: 512000,
              mime_type: 'image/png',
            },
          ],
        },
      },
      {
        id: 'post-fallback-ids',
        user_id: 'user-2',
        channel_id: mockChannel.id,
        message: 'Raw file upload',
        create_at: 2000,
        file_ids: ['raw-id-99'],
      },
    ];

    const result = extractChatData(mockChannel, postsWithMedia, usersMap, 'user-1', {
      baseUrl: 'http://localhost:3000',
    });

    expect(result.stats.totalMedia).toBe(3);

    const firstMsgMedia = result.messages[0].media;
    expect(firstMsgMedia.length).toBe(2);
    expect(firstMsgMedia[0].url).toBe('http://localhost:3000/api/files/file-doc-1');
    expect(firstMsgMedia[0].mimeType).toBe('application/pdf');
    expect(firstMsgMedia[0].formattedSize).toBe('200.0 KB');
    expect(firstMsgMedia[1].previewUrl).toBe('http://localhost:3000/api/files/file-img-2/preview');

    const secondMsgMedia = result.messages[1].media;
    expect(secondMsgMedia.length).toBe(1);
    expect(secondMsgMedia[0].url).toBe('http://localhost:3000/api/files/raw-id-99');
  });

  it('extracts embedded URLs and bot attachments into structured content', () => {
    const botPost: Post = {
      id: 'bot-post-1',
      user_id: 'bot-user',
      channel_id: mockChannel.id,
      message: '',
      create_at: 5000,
      props: {
        override_username: 'kimi-k2',
        from_bot: 'true',
        attachments: [
          {
            title: 'CI/CD Pipeline Completed',
            text: 'All 57 tests passed. See report at https://ci.example.com/build/1234',
          },
        ],
      },
    };

    expect(extractMessageText(botPost)).toContain('CI/CD Pipeline Completed');
    expect(extractMessageText(botPost)).toContain('All 57 tests passed');

    const result = extractChatData(mockChannel, [botPost], usersMap);
    expect(result.messages[0].isBot).toBe(true);
    expect(result.messages[0].authorName).toBe('kimi-k2');
    expect(result.messages[0].links).toEqual(['https://ci.example.com/build/1234']);
  });

  it('generates Markdown tailored for LLM todolist creation', () => {
    const posts: Post[] = [
      {
        id: 'p1',
        user_id: 'user-1',
        channel_id: mockChannel.id,
        message: 'Alice: I will prepare the database migration by Friday.',
        create_at: 1700000000000,
      },
      {
        id: 'p2',
        user_id: 'user-2',
        channel_id: mockChannel.id,
        message: 'Bob: Reviewing the API specs now at https://api.docs.dev',
        create_at: 1700000005000,
        metadata: {
          files: [
            {
              id: 'file-1',
              name: 'schema.sql',
              extension: 'sql',
              size: 4096,
              mime_type: 'text/x-sql',
            },
          ],
        },
      },
    ];

    const result = extractChatData(mockChannel, posts, usersMap, 'user-1', {
      baseUrl: 'http://localhost:3000',
    });

    const markdownWithPrompt = result.toMarkdown({ includePrompt: true });
    expect(markdownWithPrompt).toContain('# Chat Transcript: Project Launch');
    expect(markdownWithPrompt).toContain('## LLM Instructions: Action Items & Todo List');
    expect(markdownWithPrompt).toContain('Alice Johnson (@alice) [YOU]');
    expect(markdownWithPrompt).toContain('Bob Smith (@bob)');
    expect(markdownWithPrompt).toContain('[schema.sql](http://localhost:3000/api/files/file-1)');
    expect(markdownWithPrompt).toContain('https://api.docs.dev');

    const markdownWithoutPrompt = result.toMarkdown({ includePrompt: false });
    expect(markdownWithoutPrompt).not.toContain('## LLM Instructions');
    expect(markdownWithoutPrompt).toContain('## Chat Messages (Chronological)');
  });

  it('generates structured JSON payload for LLMs', () => {
    const post: Post = {
      id: 'p-json',
      user_id: 'user-1',
      channel_id: mockChannel.id,
      message: 'Deploying v2.0 to staging',
      create_at: 1700000000000,
    };

    const result = extractChatData(mockChannel, [post], usersMap, 'user-1');
    const jsonStr = result.toJSON({ includePrompt: true });
    const parsed = JSON.parse(jsonStr);

    expect(parsed.system_prompt).toBeDefined();
    expect(parsed.channel.displayName).toBe('Project Launch');
    expect(parsed.stats.totalLoadedMessages).toBe(1);
    expect(parsed.messages[0].author.name).toBe('Alice Johnson');
    expect(parsed.messages[0].author.is_current_user).toBe(true);
  });
});
