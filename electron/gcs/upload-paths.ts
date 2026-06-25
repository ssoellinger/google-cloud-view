import { stat, readdir } from 'fs/promises';
import { join } from 'path';

export interface UploadItem {
  filePath: string;
  key: string;
}

/**
 * Resolve a mix of dropped file and folder paths into a flat list of files with
 * their destination object keys. Folders are walked recursively and their
 * structure is recreated under destPrefix (e.g. destPrefix + folderName + "/...").
 */
export async function expandUploadPaths(paths: string[], destPrefix: string): Promise<UploadItem[]> {
  const items: UploadItem[] = [];

  const walk = async (dir: string, keyPrefix: string): Promise<void> => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, keyPrefix + entry.name + '/');
      } else if (entry.isFile()) {
        items.push({ filePath: full, key: keyPrefix + entry.name });
      }
    }
  };

  for (const p of paths) {
    const baseName = p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || 'file';
    const info = await stat(p);
    if (info.isDirectory()) {
      await walk(p, destPrefix + baseName + '/');
    } else {
      items.push({ filePath: p, key: destPrefix + baseName });
    }
  }

  return items;
}
