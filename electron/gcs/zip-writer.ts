import { createWriteStream } from 'fs';
import { unlink } from 'fs/promises';
import { ZipArchive } from 'archiver';

/**
 * Streams the given objects into a zip at savePath. Files are fetched one at a time and the
 * next download only starts once archiver has consumed the previous entry, so memory stays
 * bounded by a single file. On any failure the partial zip is closed and deleted.
 */
export async function writeZip(
  savePath: string,
  entries: { key: string; name: string }[],
  download: (key: string) => Promise<Buffer>,
  onEntryDone: (done: number) => void,
): Promise<void> {
  const output = createWriteStream(savePath);
  const archive = new ZipArchive({ zlib: { level: 5 } });
  const finished = new Promise<void>((resolve, reject) => {
    output.on('close', resolve);
    output.on('error', reject);
    archive.on('error', reject);
  });
  finished.catch(() => {}); // observed below; avoids an unhandled rejection mid-loop
  archive.pipe(output);

  try {
    for (let i = 0; i < entries.length; i++) {
      const buffer = await download(entries[i].key);
      const consumed = new Promise<void>(resolve => archive.once('entry', () => resolve()));
      archive.append(buffer, { name: entries[i].name });
      await Promise.race([consumed, finished]);
      onEntryDone(i + 1);
    }
    await archive.finalize();
    await finished;
  } catch (err) {
    archive.abort();
    // Wait for the file handle to close before deleting; Windows refuses to unlink open files
    await new Promise<void>(resolve => {
      if (output.closed) return resolve();
      output.once('close', () => resolve());
      output.destroy();
    });
    await unlink(savePath).catch(() => {});
    throw err;
  }
}
