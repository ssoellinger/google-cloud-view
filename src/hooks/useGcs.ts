import { useState, useCallback } from 'react';

export interface GcsConfig {
  serviceUrl: string;
  bucketName: string;
  accessId: string;
  secret: string;
  basePath: string;
  timeout: number;
}

export interface GcsObject {
  key: string;
  size: number;
  lastModified: string;
}

export interface ListResult {
  objects: GcsObject[];
  folders: string[];
}

export function useGcs() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPrefix, setCurrentPrefix] = useState('');
  const [items, setItems] = useState<ListResult>({ objects: [], folders: [] });

  const connect = useCallback(async (config: GcsConfig) => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.gcsApi.connect(config);
      if (result.success) {
        setConnected(true);
        const prefix = config.basePath ? config.basePath + '/' : '';
        setCurrentPrefix(prefix);
        await refreshList(prefix);
      } else {
        setError(result.error || 'Connection failed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshList = useCallback(async (prefix?: string) => {
    setLoading(true);
    setError(null);
    try {
      const p = prefix ?? currentPrefix;
      const result = await window.gcsApi.list(p);
      setItems(result);
      if (prefix !== undefined) setCurrentPrefix(p);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentPrefix]);

  const navigateTo = useCallback(async (prefix: string) => {
    await refreshList(prefix);
  }, [refreshList]);

  const uploadFiles = useCallback(async () => {
    setError(null);
    const filePaths = await window.gcsApi.openFileDialog();
    if (!filePaths) return;

    setLoading(true);
    try {
      for (const filePath of filePaths) {
        const fileName = filePath.replace(/\\/g, '/').split('/').pop()!;
        const key = currentPrefix + fileName;
        await window.gcsApi.upload(key, filePath);
      }
      await refreshList();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentPrefix, refreshList]);

  const downloadFile = useCallback(async (key: string) => {
    setError(null);
    const fileName = key.split('/').pop() || 'download';
    const savePath = await window.gcsApi.saveFileDialog(fileName);
    if (!savePath) return;

    setLoading(true);
    try {
      await window.gcsApi.download(key, savePath);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteFiles = useCallback(async (keys: string[]) => {
    setLoading(true);
    setError(null);
    try {
      for (const key of keys) {
        await window.gcsApi.delete(key);
      }
      await refreshList();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [refreshList]);

  const moveFile = useCallback(async (sourceKey: string, destKey: string) => {
    setLoading(true);
    setError(null);
    try {
      await window.gcsApi.move(sourceKey, destKey);
      await refreshList();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [refreshList]);

  const createFolder = useCallback(async (folderName: string) => {
    setLoading(true);
    setError(null);
    try {
      const key = currentPrefix + folderName + '/';
      await window.gcsApi.createFolder(key);
      await refreshList();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [currentPrefix, refreshList]);

  return {
    connected,
    loading,
    error,
    currentPrefix,
    items,
    connect,
    refreshList,
    navigateTo,
    uploadFiles,
    downloadFile,
    deleteFiles,
    moveFile,
    createFolder,
  };
}
