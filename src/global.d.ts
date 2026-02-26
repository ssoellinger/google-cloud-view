interface ProgressData {
  operation: 'upload' | 'download';
  key: string;
  fileName: string;
  loaded: number;
  total: number;
  percent: number;
}

interface GcsApi {
  connect(config: {
    serviceUrl: string;
    bucketName: string;
    accessId: string;
    secret: string;
    basePath: string;
    timeout: number;
  }): Promise<{ success: boolean; error?: string }>;
  list(prefix: string): Promise<{
    objects: Array<{ key: string; size: number; lastModified: string }>;
    folders: string[];
  }>;
  upload(key: string, filePath: string): Promise<void>;
  download(key: string, savePath: string): Promise<void>;
  delete(key: string): Promise<void>;
  move(sourceKey: string, destKey: string): Promise<void>;
  copy(sourceKey: string, destKey: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  createFolder(key: string): Promise<void>;
  openFileDialog(): Promise<string[] | null>;
  saveFileDialog(defaultName: string): Promise<string | null>;
  onProgress(callback: (data: ProgressData) => void): any;
  removeProgressListener(handler: any): void;
  getPathForFile(file: File): string;
}

interface Window {
  gcsApi: GcsApi;
}
