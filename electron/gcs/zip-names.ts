/**
 * Returns `name`, or `name (2)`, `name (3)`, ... if it is already in `used`, and records it.
 * For files the suffix goes before the extension ("config (2).json"); folders get it at
 * the end ("logs (2)"). Comparison is case-insensitive because Windows extracts that way.
 */
export function uniqueZipName(name: string, used: Set<string>, isFolder = false): string {
  let candidate = name;
  const dot = isFolder ? -1 : name.lastIndexOf('.');
  const hasExt = dot > 0; // ".env" is a name, not an extension
  const base = hasExt ? name.slice(0, dot) : name;
  const ext = hasExt ? name.slice(dot) : '';
  for (let n = 2; used.has(candidate.toLowerCase()); n++) {
    candidate = `${base} (${n})${ext}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}
