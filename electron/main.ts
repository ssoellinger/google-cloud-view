import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { GcsClient } from './gcs/gcs-client';
import type { StorageBlobConfig } from './gcs/gcs-types';

let mainWindow: BrowserWindow | null = null;
let gcsClient: GcsClient | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Google Cloud View',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// --- IPC Handlers ---

ipcMain.handle('gcs:connect', async (_event, config: StorageBlobConfig) => {
  try {
    gcsClient = new GcsClient(config);
    // Test connection by listing root
    await gcsClient.listFolders(config.basePath ? config.basePath + '/' : undefined);
    return { success: true };
  } catch (err: any) {
    gcsClient = null;
    return { success: false, error: err.message };
  }
});

ipcMain.handle('gcs:list', async (_event, prefix: string) => {
  if (!gcsClient) throw new Error('Not connected');
  return await gcsClient.listFolders(prefix || undefined);
});

ipcMain.handle('gcs:upload', async (_event, key: string, filePath: string) => {
  if (!gcsClient) throw new Error('Not connected');
  const buffer = await readFile(filePath);
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    pdf: 'application/pdf', txt: 'text/plain', html: 'text/html',
    json: 'application/json', xml: 'application/xml', csv: 'text/csv',
    zip: 'application/zip', mp4: 'video/mp4', mp3: 'audio/mpeg',
  };
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  await gcsClient.uploadItem(key, buffer, contentType);
});

ipcMain.handle('gcs:download', async (_event, key: string, savePath: string) => {
  if (!gcsClient) throw new Error('Not connected');
  const buffer = await gcsClient.downloadItem(key);
  await writeFile(savePath, buffer);
});

ipcMain.handle('gcs:delete', async (_event, key: string) => {
  if (!gcsClient) throw new Error('Not connected');
  await gcsClient.deleteItem(key);
});

ipcMain.handle('gcs:move', async (_event, sourceKey: string, destKey: string) => {
  if (!gcsClient) throw new Error('Not connected');
  await gcsClient.moveItem(sourceKey, destKey);
});

ipcMain.handle('gcs:createFolder', async (_event, key: string) => {
  if (!gcsClient) throw new Error('Not connected');
  // Create a zero-byte placeholder object to represent the folder
  await gcsClient.uploadItem(key, Buffer.alloc(0), 'application/x-directory');
});

ipcMain.handle('gcs:exists', async (_event, key: string) => {
  if (!gcsClient) throw new Error('Not connected');
  return await gcsClient.fileExists(key);
});

ipcMain.handle('dialog:openFile', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
  });
  if (result.canceled) return null;
  return result.filePaths;
});

ipcMain.handle('dialog:saveFile', async (_event, defaultName: string) => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
  });
  if (result.canceled) return null;
  return result.filePath;
});
