import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { createWriteStream } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import archiver from 'archiver';
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
  const fileName = filePath.replace(/\\/g, '/').split('/').pop() || key;
  mainWindow?.webContents.send('gcs:progress', {
    operation: 'upload', key, fileName, loaded: 0, total: 1, percent: 0,
  });
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
  mainWindow?.webContents.send('gcs:progress', {
    operation: 'upload', key, fileName, loaded: 1, total: 1, percent: 100,
  });
});

ipcMain.handle('gcs:download', async (_event, key: string, savePath: string) => {
  if (!gcsClient) throw new Error('Not connected');
  const fileName = key.split('/').pop() || key;
  mainWindow?.webContents.send('gcs:progress', {
    operation: 'download', key, fileName, loaded: 0, total: 1, percent: 0,
  });
  const buffer = await gcsClient.downloadItemWithProgress(key, (loaded, total) => {
    mainWindow?.webContents.send('gcs:progress', {
      operation: 'download', key, fileName, loaded, total,
      percent: total > 0 ? Math.round((loaded / total) * 100) : 0,
    });
  });
  await writeFile(savePath, buffer);
  mainWindow?.webContents.send('gcs:progress', {
    operation: 'download', key, fileName, loaded: 1, total: 1, percent: 100,
  });
});

ipcMain.handle('gcs:downloadFolder', async (_event, folderKey: string, savePath: string) => {
  if (!gcsClient) throw new Error('Not connected');
  const folderName = folderKey.replace(/\/$/, '').split('/').pop() || 'folder';
  const allObjects = await gcsClient.listItems(folderKey);
  const files = allObjects.filter(o => !o.key.endsWith('/'));
  if (files.length === 0) throw new Error('Folder is empty');

  mainWindow?.webContents.send('gcs:progress', {
    operation: 'download', key: folderKey, fileName: folderName + '.zip', loaded: 0, total: files.length, percent: 0,
  });

  const output = createWriteStream(savePath);
  const archive = archiver('zip', { zlib: { level: 5 } });
  const finished = new Promise<void>((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
  });
  archive.pipe(output);

  for (let i = 0; i < files.length; i++) {
    const obj = files[i];
    const relativePath = obj.key.slice(folderKey.length);
    const buffer = await gcsClient.downloadItem(obj.key);
    archive.append(buffer, { name: relativePath });
    mainWindow?.webContents.send('gcs:progress', {
      operation: 'download', key: folderKey, fileName: folderName + '.zip',
      loaded: i + 1, total: files.length,
      percent: Math.round(((i + 1) / files.length) * 100),
    });
  }

  await archive.finalize();
  await finished;
});

ipcMain.handle('gcs:delete', async (_event, key: string) => {
  if (!gcsClient) throw new Error('Not connected');
  await gcsClient.deleteItem(key);
});

ipcMain.handle('gcs:move', async (_event, sourceKey: string, destKey: string) => {
  if (!gcsClient) throw new Error('Not connected');
  await gcsClient.moveItem(sourceKey, destKey);
});

ipcMain.handle('gcs:copy', async (_event, sourceKey: string, destKey: string) => {
  if (!gcsClient) throw new Error('Not connected');
  if (sourceKey.endsWith('/')) {
    await gcsClient.copyFolder(sourceKey, destKey);
  } else {
    await gcsClient.copyItem(sourceKey, destKey);
  }
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
