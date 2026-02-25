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
  exists(key: string): Promise<boolean>;
  createFolder(key: string): Promise<void>;
  openFileDialog(): Promise<string[] | null>;
  saveFileDialog(defaultName: string): Promise<string | null>;
}

interface Window {
  gcsApi: GcsApi;
}
