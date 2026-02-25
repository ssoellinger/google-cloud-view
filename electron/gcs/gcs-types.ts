export interface StorageBlobConfig {
  serviceUrl: string;
  bucketName: string;
  accessId: string;
  secret: string;
  basePath: string;
  timeout: number;
}

export interface GoogleCloudObject {
  key: string;
  size: number;
  lastModified: string;
}

export interface ListResult {
  objects: GoogleCloudObject[];
  folders: string[];
}
