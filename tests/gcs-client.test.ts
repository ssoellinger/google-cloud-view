import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GcsClient } from '../electron/gcs/gcs-client';
import type { StorageBlobConfig } from '../electron/gcs/gcs-types';

const config: StorageBlobConfig = {
  serviceUrl: 'https://storage.example.com/',
  bucketName: 'test-bucket',
  accessId: 'TESTID',
  secret: 'TESTSECRET',
  basePath: '',
  timeout: 30000,
};

// Helper to capture what sendRequest receives
function createClientWithMock() {
  const client = new GcsClient(config);
  const calls: { method: string; url: string; canonicalResource: string; amzHeaders?: Record<string, string> }[] = [];
  const mockResponse = {
    ok: true,
    status: 200,
    text: async () => '',
    arrayBuffer: async () => new ArrayBuffer(0),
    headers: new Headers(),
  } as unknown as Response;

  // Override sendRequest to capture calls
  (client as any).sendRequest = vi.fn(async (method: string, url: string, canonicalResource: string, _body?: any, _ct?: string, amzHeaders?: Record<string, string>) => {
    calls.push({ method, url, canonicalResource, amzHeaders });
    return mockResponse;
  });

  return { client, calls, mockSendRequest: (client as any).sendRequest };
}

describe('GcsClient', () => {
  describe('constructor', () => {
    it('appends trailing slash to serviceUrl if missing', () => {
      const c = new GcsClient({ ...config, serviceUrl: 'https://example.com' });
      expect((c as any).config.serviceUrl).toBe('https://example.com/');
    });

    it('keeps trailing slash if already present', () => {
      const c = new GcsClient({ ...config, serviceUrl: 'https://example.com/' });
      expect((c as any).config.serviceUrl).toBe('https://example.com/');
    });
  });

  describe('encodeKey', () => {
    it('encodes spaces in file names', () => {
      const client = new GcsClient(config);
      const encoded = (client as any).encodeKey('folder/my file.txt');
      expect(encoded).toBe('folder/my%20file.txt');
    });

    it('encodes special characters but preserves slashes', () => {
      const client = new GcsClient(config);
      const encoded = (client as any).encodeKey('path/to/Ünïcödé (1).txt');
      expect(encoded).toContain('path/to/');
      expect(encoded).not.toContain(' ');
      // Slashes are preserved
      expect(encoded.split('/').length).toBe(3);
    });

    it('handles keys without special characters', () => {
      const client = new GcsClient(config);
      const encoded = (client as any).encodeKey('folder/simple.txt');
      expect(encoded).toBe('folder/simple.txt');
    });

    it('handles empty segments', () => {
      const client = new GcsClient(config);
      const encoded = (client as any).encodeKey('folder/');
      expect(encoded).toBe('folder/');
    });
  });

  describe('uploadItem', () => {
    it('encodes the key in URL and canonical resource', async () => {
      const { client, calls } = createClientWithMock();
      await client.uploadItem('path/my file.txt', Buffer.from('hello'), 'text/plain');

      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe('PUT');
      expect(calls[0].url).toBe('https://storage.example.com/test-bucket/path/my%20file.txt');
      expect(calls[0].canonicalResource).toBe('/test-bucket/path/my%20file.txt');
    });

    it('works with simple keys', async () => {
      const { client, calls } = createClientWithMock();
      await client.uploadItem('simple.txt', Buffer.from('hi'));

      expect(calls[0].url).toBe('https://storage.example.com/test-bucket/simple.txt');
    });
  });

  describe('downloadItem', () => {
    it('encodes the key in URL', async () => {
      const { client, calls } = createClientWithMock();
      await client.downloadItem('path/Ünïcödé file.bin');

      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe('GET');
      expect(calls[0].url).toContain('%C3%9Cn%C3%AFc%C3%B6d%C3%A9%20file.bin');
    });
  });

  describe('deleteItem', () => {
    it('encodes the key', async () => {
      const { client, calls } = createClientWithMock();
      await client.deleteItem('folder/spaced name.txt');

      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe('DELETE');
      expect(calls[0].url).toContain('spaced%20name.txt');
    });
  });

  describe('copyItem', () => {
    it('encodes both source and dest keys', async () => {
      const { client, calls } = createClientWithMock();
      await client.copyItem('src/my file.txt', 'dest/my file.txt');

      expect(calls).toHaveLength(1);
      expect(calls[0].method).toBe('PUT');
      expect(calls[0].url).toContain('dest/my%20file.txt');
      expect(calls[0].canonicalResource).toContain('dest/my%20file.txt');
      expect(calls[0].amzHeaders?.['x-amz-copy-source']).toContain('src/my%20file.txt');
    });
  });

  describe('moveItem', () => {
    it('copies then deletes for files', async () => {
      const { client, calls } = createClientWithMock();
      await client.moveItem('a.txt', 'b.txt');

      // copyItem + deleteItem = 2 calls
      expect(calls).toHaveLength(2);
      expect(calls[0].method).toBe('PUT'); // copy
      expect(calls[1].method).toBe('DELETE'); // delete original
    });

    it('handles folder moves: lists, copies all, deletes all', async () => {
      const client = new GcsClient(config);

      // Mock listItems to return 2 objects
      (client as any).listItems = vi.fn(async () => [
        { key: 'src/a.txt', size: 10, lastModified: '' },
        { key: 'src/b.txt', size: 20, lastModified: '' },
      ]);

      const ops: string[] = [];
      (client as any).copyItem = vi.fn(async () => { ops.push('copy'); });
      (client as any).deleteItem = vi.fn(async () => { ops.push('delete'); });

      await client.moveItem('src/', 'dest/');

      // 2 objects copied + 2 deleted + folder marker copy + folder marker delete
      expect((client as any).copyItem).toHaveBeenCalledWith('src/a.txt', 'dest/a.txt');
      expect((client as any).copyItem).toHaveBeenCalledWith('src/b.txt', 'dest/b.txt');
      expect((client as any).deleteItem).toHaveBeenCalledWith('src/a.txt');
      expect((client as any).deleteItem).toHaveBeenCalledWith('src/b.txt');
    });
  });

  describe('copyFolder', () => {
    it('copies all objects under source prefix to dest prefix', async () => {
      const client = new GcsClient(config);

      (client as any).listItems = vi.fn(async () => [
        { key: 'src/file1.txt', size: 10, lastModified: '' },
        { key: 'src/sub/file2.txt', size: 20, lastModified: '' },
      ]);
      (client as any).copyItem = vi.fn(async () => {});

      await client.copyFolder('src/', 'dest/');

      expect((client as any).copyItem).toHaveBeenCalledWith('src/file1.txt', 'dest/file1.txt');
      expect((client as any).copyItem).toHaveBeenCalledWith('src/sub/file2.txt', 'dest/sub/file2.txt');
      // Also copies folder marker
      expect((client as any).copyItem).toHaveBeenCalledWith('src/', 'dest/');
    });
  });

  describe('fileExists', () => {
    it('returns true for status 200', async () => {
      const { client } = createClientWithMock();
      const result = await client.fileExists('exists.txt');
      expect(result).toBe(true);
    });

    it('returns false on error', async () => {
      const client = new GcsClient(config);
      (client as any).sendRequest = vi.fn(async () => { throw new Error('404'); });
      const result = await client.fileExists('missing.txt');
      expect(result).toBe(false);
    });
  });

  describe('signRequest', () => {
    it('returns an AWS-style auth header', () => {
      const client = new GcsClient(config);
      const auth = (client as any).signRequest('GET', '/test-bucket/', '', '', 'Thu, 01 Jan 2026 00:00:00 GMT');
      expect(auth).toMatch(/^AWS TESTID:.+$/);
    });

    it('includes amz headers in signature when provided', () => {
      const client = new GcsClient(config);
      const withoutAmz = (client as any).signRequest('PUT', '/test-bucket/key', '', '', 'Thu, 01 Jan 2026 00:00:00 GMT');
      const withAmz = (client as any).signRequest('PUT', '/test-bucket/key', '', '', 'Thu, 01 Jan 2026 00:00:00 GMT', 'x-amz-copy-source:/test-bucket/src');
      // Different signatures because of different string to sign
      expect(withoutAmz).not.toBe(withAmz);
    });
  });

  describe('downloadItemWithProgress', () => {
    it('calls onProgress with full size when no body stream', async () => {
      const client = new GcsClient(config);
      const data = Buffer.from('hello world');
      (client as any).sendRequest = vi.fn(async () => ({
        ok: true,
        headers: new Headers({ 'content-length': '0' }),
        body: null,
        arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      }));

      const progress: [number, number][] = [];
      const result = await client.downloadItemWithProgress('file.txt', (loaded, total) => {
        progress.push([loaded, total]);
      });

      expect(progress.length).toBe(1);
      expect(progress[0][0]).toBe(progress[0][1]); // loaded === total
      expect(result.length).toBe(11);
    });

    it('reports streaming progress', async () => {
      const client = new GcsClient(config);
      const chunk1 = new Uint8Array([1, 2, 3]);
      const chunk2 = new Uint8Array([4, 5]);
      let readCount = 0;
      const mockReader = {
        read: vi.fn(async () => {
          readCount++;
          if (readCount === 1) return { done: false, value: chunk1 };
          if (readCount === 2) return { done: false, value: chunk2 };
          return { done: true, value: undefined };
        }),
      };

      (client as any).sendRequest = vi.fn(async () => ({
        ok: true,
        headers: new Headers({ 'content-length': '5' }),
        body: { getReader: () => mockReader },
      }));

      const progress: [number, number][] = [];
      const result = await client.downloadItemWithProgress('file.txt', (loaded, total) => {
        progress.push([loaded, total]);
      });

      expect(progress).toEqual([[3, 5], [5, 5]]);
      expect(result.length).toBe(5);
    });
  });
});
