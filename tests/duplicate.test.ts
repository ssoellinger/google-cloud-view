/**
 * Tests for the duplicate/copy name generation logic from useGcs.
 */
import { describe, it, expect } from 'vitest';

/**
 * Re-implementation of the duplicate naming logic from useGcs.duplicateFile
 */
function getDuplicateKey(key: string): string {
  const isFolder = key.endsWith('/');
  const stripped = key.replace(/\/$/, '');
  const parts = stripped.split('/');
  const name = parts.pop()!;
  const parent = parts.length > 0 ? parts.join('/') + '/' : '';
  const dotIndex = name.lastIndexOf('.');
  let newName: string;
  if (!isFolder && dotIndex > 0) {
    newName = name.slice(0, dotIndex) + ' (copy)' + name.slice(dotIndex);
  } else {
    newName = name + ' (copy)';
  }
  return parent + newName + (isFolder ? '/' : '');
}

describe('getDuplicateKey (duplicate naming)', () => {
  it('adds (copy) before extension for files', () => {
    expect(getDuplicateKey('path/photo.jpg')).toBe('path/photo (copy).jpg');
  });

  it('handles files with multiple dots', () => {
    expect(getDuplicateKey('archive.tar.gz')).toBe('archive.tar (copy).gz');
  });

  it('handles files with no extension', () => {
    // dotIndex would be -1 (or 0 for hidden), so falls to else branch
    expect(getDuplicateKey('path/Makefile')).toBe('path/Makefile (copy)');
  });

  it('handles dotfiles (dot at position 0)', () => {
    // dotIndex is 0, not > 0, so treated as no extension
    expect(getDuplicateKey('.gitignore')).toBe('.gitignore (copy)');
  });

  it('handles folders by appending (copy) to name', () => {
    expect(getDuplicateKey('path/myfolder/')).toBe('path/myfolder (copy)/');
  });

  it('handles root-level files', () => {
    expect(getDuplicateKey('readme.txt')).toBe('readme (copy).txt');
  });

  it('handles root-level folders', () => {
    expect(getDuplicateKey('docs/')).toBe('docs (copy)/');
  });

  it('handles deeply nested paths', () => {
    expect(getDuplicateKey('a/b/c/d/file.txt')).toBe('a/b/c/d/file (copy).txt');
  });

  it('handles files with spaces in name', () => {
    expect(getDuplicateKey('my folder/my file.txt')).toBe('my folder/my file (copy).txt');
  });
});
