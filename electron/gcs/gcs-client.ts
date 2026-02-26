import { createHmac } from 'crypto';
import { XMLParser } from 'fast-xml-parser';
import type { StorageBlobConfig, GoogleCloudObject, ListResult } from './gcs-types';

export class GcsClient {
  private config: StorageBlobConfig;
  private parser: XMLParser;

  constructor(config: StorageBlobConfig) {
    this.config = { ...config };
    if (!this.config.serviceUrl.endsWith('/')) {
      this.config.serviceUrl += '/';
    }
    this.parser = new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
    });
  }

  /** URL-encode each path segment so spaces/special chars match the signature */
  private encodeKey(key: string): string {
    return key.split('/').map(s => encodeURIComponent(s)).join('/');
  }

  private signRequest(
    method: string,
    canonicalResource: string,
    contentMd5 = '',
    contentType = '',
    date?: string,
    canonicalizedAmzHeaders?: string,
  ): string {
    if (!date) {
      date = new Date().toUTCString();
    }

    const stringToSign = canonicalizedAmzHeaders
      ? `${method}\n${contentMd5}\n${contentType}\n${date}\n${canonicalizedAmzHeaders}\n${canonicalResource}`
      : `${method}\n${contentMd5}\n${contentType}\n${date}\n${canonicalResource}`;

    const hmac = createHmac('sha1', this.config.secret);
    hmac.update(stringToSign, 'utf8');
    const signature = hmac.digest('base64');

    return `AWS ${this.config.accessId}:${signature}`;
  }

  private async sendRequest(
    method: string,
    url: string,
    canonicalResource: string,
    body?: Buffer | null,
    contentType = '',
    amzHeaders?: Record<string, string>,
  ): Promise<Response> {
    const date = new Date().toUTCString();

    let canonicalizedAmzHeaders: string | undefined;
    if (amzHeaders && Object.keys(amzHeaders).length > 0) {
      canonicalizedAmzHeaders = Object.entries(amzHeaders)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${v}`)
        .join('\n');
    }

    const authorization = this.signRequest(
      method,
      canonicalResource,
      '',
      contentType,
      date,
      canonicalizedAmzHeaders,
    );

    const headers: Record<string, string> = {
      Authorization: authorization,
      Date: date,
    };

    if (amzHeaders) {
      Object.assign(headers, amzHeaders);
    }

    if (contentType && body) {
      headers['Content-Type'] = contentType;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? new Uint8Array(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok && !(method === 'DELETE' && response.status === 404) && !(method === 'HEAD' && response.status === 404)) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${response.statusText}\n${text}`);
      }

      return response;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async listItems(prefix?: string, pageSize = 1000): Promise<GoogleCloudObject[]> {
    if (pageSize <= 0 || pageSize > 1000) pageSize = 1000;

    const results: GoogleCloudObject[] = [];
    let continuationToken: string | undefined;

    while (true) {
      const queryParams: string[] = ['list-type=2', `max-keys=${pageSize}`];

      if (prefix) queryParams.push(`prefix=${encodeURIComponent(prefix)}`);
      if (continuationToken) queryParams.push(`continuation-token=${encodeURIComponent(continuationToken)}`);

      const query = '?' + queryParams.join('&');
      const url = `${this.config.serviceUrl}${this.config.bucketName}/${query}`;
      const canonicalResource = `/${this.config.bucketName}/`;

      const response = await this.sendRequest('GET', url, canonicalResource);
      const xml = await response.text();
      const doc = this.parser.parse(xml);

      const root = doc.ListBucketResult;
      if (!root) break;

      const contents = root.Contents
        ? Array.isArray(root.Contents) ? root.Contents : [root.Contents]
        : [];

      for (const item of contents) {
        results.push({
          key: item.Key,
          size: Number(item.Size) || 0,
          lastModified: item.LastModified,
        });
      }

      const isTruncated = root.IsTruncated === true || root.IsTruncated === 'true';
      if (!isTruncated) break;

      continuationToken = root.NextContinuationToken;
      if (!continuationToken) {
        throw new Error('Response is truncated but no NextContinuationToken was provided.');
      }
    }

    return results;
  }

  async listFolders(prefix?: string): Promise<ListResult> {
    const queryParams: string[] = ['list-type=2', 'max-keys=1000', 'delimiter=/'];

    if (prefix) queryParams.push(`prefix=${encodeURIComponent(prefix)}`);

    const query = '?' + queryParams.join('&');
    const url = `${this.config.serviceUrl}${this.config.bucketName}/${query}`;
    const canonicalResource = `/${this.config.bucketName}/`;

    const response = await this.sendRequest('GET', url, canonicalResource);
    const xml = await response.text();
    const doc = this.parser.parse(xml);

    const root = doc.ListBucketResult;
    const objects: GoogleCloudObject[] = [];
    const folders: string[] = [];

    if (root) {
      const contents = root.Contents
        ? Array.isArray(root.Contents) ? root.Contents : [root.Contents]
        : [];

      for (const item of contents) {
        // Skip the prefix itself (folder placeholder)
        if (item.Key === prefix) continue;
        objects.push({
          key: item.Key,
          size: Number(item.Size) || 0,
          lastModified: item.LastModified,
        });
      }

      const prefixes = root.CommonPrefixes
        ? Array.isArray(root.CommonPrefixes) ? root.CommonPrefixes : [root.CommonPrefixes]
        : [];

      for (const p of prefixes) {
        folders.push(p.Prefix);
      }
    }

    return { objects, folders };
  }

  async uploadItem(objectName: string, buffer: Buffer, contentType = 'application/octet-stream'): Promise<void> {
    const encoded = this.encodeKey(objectName);
    const url = `${this.config.serviceUrl}${this.config.bucketName}/${encoded}`;
    const canonicalResource = `/${this.config.bucketName}/${encoded}`;
    await this.sendRequest('PUT', url, canonicalResource, buffer, contentType);
  }

  async downloadItem(objectName: string): Promise<Buffer> {
    const encoded = this.encodeKey(objectName);
    const url = `${this.config.serviceUrl}${this.config.bucketName}/${encoded}`;
    const canonicalResource = `/${this.config.bucketName}/${encoded}`;
    const response = await this.sendRequest('GET', url, canonicalResource);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async downloadItemWithProgress(
    objectName: string,
    onProgress: (loaded: number, total: number) => void,
  ): Promise<Buffer> {
    const encoded = this.encodeKey(objectName);
    const url = `${this.config.serviceUrl}${this.config.bucketName}/${encoded}`;
    const canonicalResource = `/${this.config.bucketName}/${encoded}`;
    const response = await this.sendRequest('GET', url, canonicalResource);

    const contentLength = parseInt(response.headers.get('content-length') || '0', 10);
    if (!response.body || !contentLength) {
      const arrayBuffer = await response.arrayBuffer();
      onProgress(arrayBuffer.byteLength, arrayBuffer.byteLength);
      return Buffer.from(arrayBuffer);
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.byteLength;
      onProgress(loaded, contentLength);
    }

    const combined = Buffer.concat(chunks);
    return combined;
  }

  async deleteItem(objectName: string): Promise<void> {
    const encoded = this.encodeKey(objectName);
    const url = `${this.config.serviceUrl}${this.config.bucketName}/${encoded}`;
    const canonicalResource = `/${this.config.bucketName}/${encoded}`;
    await this.sendRequest('DELETE', url, canonicalResource);
  }

  async copyItem(sourceKey: string, destKey: string): Promise<void> {
    const encodedDest = this.encodeKey(destKey);
    const encodedSource = this.encodeKey(sourceKey);
    const url = `${this.config.serviceUrl}${this.config.bucketName}/${encodedDest}`;
    const canonicalResource = `/${this.config.bucketName}/${encodedDest}`;
    const copySource = `/${this.config.bucketName}/${encodedSource}`;
    await this.sendRequest('PUT', url, canonicalResource, null, '', {
      'x-amz-copy-source': copySource,
    });
  }

  async copyFolder(sourceKey: string, destKey: string): Promise<void> {
    const allObjects = await this.listItems(sourceKey);
    for (const obj of allObjects) {
      const relativePath = obj.key.slice(sourceKey.length);
      const newKey = destKey + relativePath;
      await this.copyItem(obj.key, newKey);
    }
    // Also copy the folder marker itself if it exists
    try {
      await this.copyItem(sourceKey, destKey);
    } catch {
      // folder marker may not exist
    }
  }

  async moveItem(sourceKey: string, destKey: string): Promise<void> {
    if (sourceKey.endsWith('/')) {
      // Folder move: list all objects under the source prefix and move each one
      const allObjects = await this.listItems(sourceKey);
      for (const obj of allObjects) {
        const relativePath = obj.key.slice(sourceKey.length);
        const newKey = destKey + relativePath;
        await this.copyItem(obj.key, newKey);
        await this.deleteItem(obj.key);
      }
      // Also move the folder marker itself if it exists
      try {
        await this.copyItem(sourceKey, destKey);
        await this.deleteItem(sourceKey);
      } catch {
        // folder marker may not exist as an object
      }
    } else {
      await this.copyItem(sourceKey, destKey);
      await this.deleteItem(sourceKey);
    }
  }

  async fileExists(objectName: string): Promise<boolean> {
    const encoded = this.encodeKey(objectName);
    const url = `${this.config.serviceUrl}${this.config.bucketName}/${encoded}`;
    const canonicalResource = `/${this.config.bucketName}/${encoded}`;
    try {
      const response = await this.sendRequest('HEAD', url, canonicalResource);
      return response.status === 200;
    } catch {
      return false;
    }
  }
}
