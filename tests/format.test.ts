import { describe, it, expect } from 'vitest';
import { formatSize, formatDate, getErrorMessage } from '../src/utils/format';

describe('formatSize', () => {
  it('returns dash for zero bytes', () => {
    expect(formatSize(0)).toBe('-');
  });

  it('formats bytes', () => {
    expect(formatSize(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatSize(1024)).toBe('1.0 KB');
    expect(formatSize(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatSize(1048576)).toBe('1.0 MB');
  });

  it('formats gigabytes', () => {
    expect(formatSize(1073741824)).toBe('1.0 GB');
  });
});

describe('formatDate', () => {
  it('returns dash for empty string', () => {
    expect(formatDate('')).toBe('-');
  });

  it('returns dash for undefined', () => {
    expect(formatDate(undefined)).toBe('-');
  });

  it('formats a valid ISO date', () => {
    const result = formatDate('2024-06-15T10:30:00Z');
    // Just check it contains something (locale-dependent output)
    expect(result).not.toBe('-');
    expect(result.length).toBeGreaterThan(5);
  });
});

describe('getErrorMessage', () => {
  it('returns message from Error objects', () => {
    expect(getErrorMessage(new Error('oops'))).toBe('oops');
  });

  it('stringifies non-Error values', () => {
    expect(getErrorMessage('some string')).toBe('some string');
    expect(getErrorMessage(42)).toBe('42');
  });
});
