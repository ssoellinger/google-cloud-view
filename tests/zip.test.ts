import { describe, it, expect, afterAll } from 'vitest';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { uniqueZipName } from '../electron/gcs/zip-names';
import { writeZip } from '../electron/gcs/zip-writer';

describe('uniqueZipName', () => {
  it('suffixes duplicate file names before the extension', () => {
    const used = new Set<string>();
    expect(uniqueZipName('config.json', used)).toBe('config.json');
    expect(uniqueZipName('config.json', used)).toBe('config (2).json');
    expect(uniqueZipName('Config.JSON', used)).toBe('Config (3).JSON');
  });

  it('suffixes folders and dotfiles at the end', () => {
    const used = new Set<string>();
    expect(uniqueZipName('logs.v1', used, true)).toBe('logs.v1');
    expect(uniqueZipName('logs.v1', used, true)).toBe('logs.v1 (2)');
    expect(uniqueZipName('.env', used)).toBe('.env');
    expect(uniqueZipName('.env', used)).toBe('.env (2)');
  });
});

describe('writeZip', () => {
  const dir = mkdtempSync(join(tmpdir(), 'gcv-zip-'));

  it('writes every entry and reports progress per file', async () => {
    const path = join(dir, 'ok.zip');
    const progress: number[] = [];
    const entries = [{ key: 'a', name: 'a.txt' }, { key: 'b', name: 'sub/b.txt' }];
    await writeZip(path, entries, async k => Buffer.from('data-' + k), d => progress.push(d));
    const zip = readFileSync(path);
    expect(zip.subarray(0, 2).toString()).toBe('PK');
    expect(zip.includes(Buffer.from('sub/b.txt'))).toBe(true);
    expect(progress).toEqual([1, 2]);
  });

  it('deletes the partial zip and rethrows when a download fails', async () => {
    const path = join(dir, 'fail.zip');
    const entries = [{ key: 'a', name: 'a.txt' }, { key: 'bad', name: 'b.txt' }];
    const download = async (k: string) => {
      if (k === 'bad') throw new Error('403 Forbidden');
      return Buffer.from('x');
    };
    await expect(writeZip(path, entries, download, () => {})).rejects.toThrow('403 Forbidden');
    expect(existsSync(path)).toBe(false);
  });

  it('rejects instead of crashing when the target cannot be written', async () => {
    const path = join(dir, 'missing-dir', 'x.zip');
    await expect(writeZip(path, [{ key: 'a', name: 'a' }], async () => Buffer.from('x'), () => {}))
      .rejects.toThrow();
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));
});
