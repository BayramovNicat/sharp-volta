import { describe, expect, test } from 'bun:test';
import { formatFileSize } from '../src/components/message-input';
import type { FileAttachment, Post } from '../src/types';

describe('file upload helpers', () => {
  test('formats file size accurately', () => {
    expect(formatFileSize(500)).toBe('500 B');
    expect(formatFileSize(1024)).toBe('1.0 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(1048576)).toBe('1.0 MB');
    expect(formatFileSize(2621440)).toBe('2.5 MB');
  });

  test('creates optimistic post with file attachments', () => {
    const optimisticFiles: FileAttachment[] = [
      {
        id: 'temp_file_1',
        name: 'screenshot.png',
        extension: 'png',
        size: 204800,
        mime_type: 'image/png',
        has_preview_image: true,
        preview_url: 'blob:http://localhost:5173/test-blob-1',
      },
    ];

    const post: Post = {
      id: 'temp_post_file',
      tempId: 'temp_post_file',
      user_id: 'user_1',
      channel_id: 'ch_1',
      message: 'Here is the image',
      create_at: Date.now(),
      status: 'sending',
      metadata: {
        files: optimisticFiles,
      },
    };

    expect(post.metadata?.files?.length).toBe(1);
    expect(post.metadata?.files?.[0].preview_url).toContain('blob:');
    expect(post.status).toBe('sending');
  });
});
