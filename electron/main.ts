import { app, BrowserWindow, ipcMain, dialog, nativeImage, clipboard, safeStorage } from 'electron';
import { createWriteStream } from 'fs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import archiver from 'archiver';
import { GcsClient } from './gcs/gcs-client';
import { expandUploadPaths } from './gcs/upload-paths';
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

function mimeForPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
    pdf: 'application/pdf', txt: 'text/plain', html: 'text/html',
    json: 'application/json', xml: 'application/xml', csv: 'text/csv',
    zip: 'application/zip', mp4: 'video/mp4', mp3: 'audio/mpeg',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

ipcMain.handle('gcs:upload', async (_event, key: string, filePath: string) => {
  if (!gcsClient) throw new Error('Not connected');
  const fileName = filePath.replace(/\\/g, '/').split('/').pop() || key;
  mainWindow?.webContents.send('gcs:progress', {
    operation: 'upload', key, fileName, loaded: 0, total: 1, percent: 0,
  });
  const buffer = await readFile(filePath);
  await gcsClient.uploadItem(key, buffer, mimeForPath(filePath));
  mainWindow?.webContents.send('gcs:progress', {
    operation: 'upload', key, fileName, loaded: 1, total: 1, percent: 100,
  });
});

// Upload a mix of files and folders. Folders are walked recursively and their
// structure is recreated under destPrefix.
ipcMain.handle('gcs:uploadPaths', async (_event, paths: string[], destPrefix: string) => {
  if (!gcsClient) throw new Error('Not connected');

  const items = await expandUploadPaths(paths, destPrefix);

  for (let i = 0; i < items.length; i++) {
    const { filePath, key } = items[i];
    const fileName = key.split('/').pop() || key;
    mainWindow?.webContents.send('gcs:progress', {
      operation: 'upload', key, fileName, loaded: i, total: items.length,
      percent: items.length > 0 ? Math.round((i / items.length) * 100) : 0,
    });
    const buffer = await readFile(filePath);
    await gcsClient.uploadItem(key, buffer, mimeForPath(filePath));
  }
  mainWindow?.webContents.send('gcs:progress', {
    operation: 'upload', key: destPrefix, fileName: `${items.length} file(s)`,
    loaded: items.length, total: items.length, percent: 100,
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

ipcMain.handle('clipboard:writeText', (_event, text: string) => {
  clipboard.writeText(text);
});

// Encrypt secrets at rest with the OS keychain (DPAPI / Keychain) so they are not
// stored in plaintext. Encrypted values carry a marker; anything else is passed
// through unchanged (legacy plaintext, or platforms without encryption support).
const ENC_PREFIX = 'enc:v1:';

ipcMain.handle('secure:encrypt', (_event, text: string) => {
  if (!text || !safeStorage.isEncryptionAvailable()) return text;
  return ENC_PREFIX + safeStorage.encryptString(text).toString('base64');
});

ipcMain.handle('secure:decrypt', (_event, text: string) => {
  if (!text || !text.startsWith(ENC_PREFIX)) return text;
  try {
    return safeStorage.decryptString(Buffer.from(text.slice(ENC_PREFIX.length), 'base64'));
  } catch {
    return ''; // can't decrypt (e.g. copied from another machine/user) -> force re-entry
  }
});

ipcMain.handle('gcs:previewFile', async (_event, key: string) => {
  if (!gcsClient) throw new Error('Not connected');
  // Returns the raw bytes; the renderer wraps them in a Blob / decodes text for display
  return await gcsClient.downloadItem(key);
});

// Recursive, server-side search: list every object under the prefix and return the
// files whose key contains the query. Lets the user find deep files without expanding.
ipcMain.handle('gcs:search', async (_event, prefix: string, query: string) => {
  if (!gcsClient) throw new Error('Not connected');
  const q = query.trim().toLowerCase();
  if (!q) return { results: [], truncated: false };
  const all = await gcsClient.listItems(prefix || undefined);
  const matches = all.filter(o => !o.key.endsWith('/') && o.key.toLowerCase().includes(q));
  const MAX = 1000;
  return { results: matches.slice(0, MAX), truncated: matches.length > MAX };
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

ipcMain.handle('gcs:downloadSelection', async (_event, keys: string[], savePath: string) => {
  if (!gcsClient) throw new Error('Not connected');
  const zipName = savePath.replace(/\\/g, '/').split('/').pop() || 'download.zip';

  // Drop any selection nested inside another selected folder to avoid duplicate entries
  const selectedFolders = keys.filter(k => k.endsWith('/'));
  const roots = keys.filter(k => !selectedFolders.some(f => f !== k && k.startsWith(f)));

  // Resolve every root selection to the concrete files that go into the archive
  const entries: { key: string; name: string }[] = [];
  for (const key of roots) {
    if (key.endsWith('/')) {
      const folderName = key.replace(/\/$/, '').split('/').pop() || 'folder';
      const objs = await gcsClient.listItems(key);
      for (const o of objs) {
        if (o.key.endsWith('/')) continue;
        entries.push({ key: o.key, name: folderName + '/' + o.key.slice(key.length) });
      }
    } else {
      entries.push({ key, name: key.split('/').pop()! });
    }
  }
  if (entries.length === 0) throw new Error('No files to download');

  mainWindow?.webContents.send('gcs:progress', {
    operation: 'download', key: zipName, fileName: zipName, loaded: 0, total: entries.length, percent: 0,
  });

  const output = createWriteStream(savePath);
  const archive = archiver('zip', { zlib: { level: 5 } });
  const finished = new Promise<void>((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
  });
  archive.pipe(output);

  for (let i = 0; i < entries.length; i++) {
    const buffer = await gcsClient.downloadItem(entries[i].key);
    archive.append(buffer, { name: entries[i].name });
    mainWindow?.webContents.send('gcs:progress', {
      operation: 'download', key: zipName, fileName: zipName,
      loaded: i + 1, total: entries.length,
      percent: Math.round(((i + 1) / entries.length) * 100),
    });
  }

  await archive.finalize();
  await finished;
});

// 1x1 transparent PNG, used only if a native file-type icon can't be resolved
const FALLBACK_DRAG_ICON =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

// startDrag must be invoked synchronously inside the drag gesture, so the file has to
// already be on disk. We prefetch on mousedown and reuse the result, keyed by object key.
const dragFileCache = new Map<string, Promise<{ tempPath: string; icon: import('electron').NativeImage }>>();

function prepareDragFile(key: string) {
  const existing = dragFileCache.get(key);
  if (existing) return existing;

  const task = (async () => {
    const fileName = key.split('/').pop() || 'download';
    const dir = join(app.getPath('temp'), 'google-cloud-view-drag');
    await mkdir(dir, { recursive: true });
    const tempPath = join(dir, fileName);

    mainWindow?.webContents.send('gcs:progress', {
      operation: 'download', key, fileName, loaded: 0, total: 1, percent: 0,
    });
    const buffer = await gcsClient!.downloadItemWithProgress(key, (loaded, total) => {
      mainWindow?.webContents.send('gcs:progress', {
        operation: 'download', key, fileName, loaded, total,
        percent: total > 0 ? Math.round((loaded / total) * 100) : 0,
      });
    });
    await writeFile(tempPath, buffer);
    mainWindow?.webContents.send('gcs:progress', {
      operation: 'download', key, fileName, loaded: 1, total: 1, percent: 100,
    });

    let icon = nativeImage.createFromDataURL(FALLBACK_DRAG_ICON);
    try {
      const fileIcon = await app.getFileIcon(tempPath, { size: 'normal' });
      if (!fileIcon.isEmpty()) icon = fileIcon;
    } catch {
      // keep fallback icon
    }

    return { tempPath, icon };
  })();

  dragFileCache.set(key, task);
  task.catch(() => dragFileCache.delete(key)); // allow a retry if the download failed
  return task;
}

// Prefetch on mousedown so the temp file is ready by the time the drag starts.
ipcMain.handle('gcs:prepareDrag', async (_event, key: string) => {
  if (!gcsClient) throw new Error('Not connected');
  try {
    await prepareDragFile(key);
  } catch {
    // any error is surfaced when the actual drag is attempted
  }
});

// Hand the (ideally already-cached) temp file to the OS as a native drag source,
// so the user can drag a row straight onto the desktop / Explorer to download it.
ipcMain.handle('gcs:startDragOut', async (event, key: string) => {
  if (!gcsClient) throw new Error('Not connected');
  const { tempPath, icon } = await prepareDragFile(key);
  event.sender.startDrag({ file: tempPath, icon });
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
