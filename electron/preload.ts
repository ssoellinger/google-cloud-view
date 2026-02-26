import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('gcsApi', {
  connect: (config: any) => ipcRenderer.invoke('gcs:connect', config),
  list: (prefix: string) => ipcRenderer.invoke('gcs:list', prefix),
  upload: (key: string, filePath: string) => ipcRenderer.invoke('gcs:upload', key, filePath),
  download: (key: string, savePath: string) => ipcRenderer.invoke('gcs:download', key, savePath),
  delete: (key: string) => ipcRenderer.invoke('gcs:delete', key),
  move: (sourceKey: string, destKey: string) => ipcRenderer.invoke('gcs:move', sourceKey, destKey),
  copy: (sourceKey: string, destKey: string) => ipcRenderer.invoke('gcs:copy', sourceKey, destKey),
  exists: (key: string) => ipcRenderer.invoke('gcs:exists', key),
  createFolder: (key: string) => ipcRenderer.invoke('gcs:createFolder', key),
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile'),
  saveFileDialog: (defaultName: string) => ipcRenderer.invoke('dialog:saveFile', defaultName),
  onProgress: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('gcs:progress', handler);
    return handler;
  },
  removeProgressListener: (handler: any) => {
    ipcRenderer.removeListener('gcs:progress', handler);
  },
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
});
