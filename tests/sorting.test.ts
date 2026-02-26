/**
 * Tests for the column sorting logic used in FileBrowser.
 * We re-implement sortNodes here since it's component-private.
 */
import { describe, it, expect } from 'vitest';
import type { TreeNode } from '../src/hooks/useGcs';

type SortField = 'name' | 'size' | 'modified';
type SortDirection = 'asc' | 'desc';

function computeFolderSize(node: TreeNode): number {
  if (!node.isFolder) return node.size;
  if (!node.children) return 0;
  return node.children.reduce((sum, child) => sum + computeFolderSize(child), 0);
}

function computeFolderLastModified(node: TreeNode): string {
  if (!node.isFolder) return node.lastModified;
  if (!node.children) return '';
  let latest = '';
  for (const child of node.children) {
    const childDate = child.isFolder ? computeFolderLastModified(child) : child.lastModified;
    if (childDate && childDate > latest) latest = childDate;
  }
  return latest;
}

function makeSortNodes(sortField: SortField, sortDirection: SortDirection) {
  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    const sorted = [...nodes].sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;

      let cmp = 0;
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      } else if (sortField === 'size') {
        const sizeA = a.isFolder ? computeFolderSize(a) : a.size;
        const sizeB = b.isFolder ? computeFolderSize(b) : b.size;
        cmp = sizeA - sizeB;
      } else {
        const modA = a.isFolder ? computeFolderLastModified(a) : a.lastModified;
        const modB = b.isFolder ? computeFolderLastModified(b) : b.lastModified;
        cmp = modA.localeCompare(modB);
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted.map(node =>
      node.children ? { ...node, children: sortNodes(node.children) } : node
    );
  };
  return sortNodes;
}

function makeNode(name: string, isFolder: boolean, size = 0, lastModified = '', children?: TreeNode[]): TreeNode {
  return {
    name,
    fullPath: (isFolder ? name + '/' : name),
    isFolder,
    size,
    lastModified,
    children,
    childrenLoaded: !!children,
  };
}

describe('sortNodes', () => {
  const fileA = makeNode('alpha.txt', false, 100, '2024-01-01');
  const fileB = makeNode('beta.txt', false, 50, '2024-06-01');
  const fileC = makeNode('gamma.txt', false, 200, '2024-03-01');
  const folderX = makeNode('xray', true, 0, '', [fileC]);
  const folderA = makeNode('alpha', true, 0, '', [fileB]);

  it('sorts by name ascending — folders first', () => {
    const sort = makeSortNodes('name', 'asc');
    const result = sort([fileB, folderX, fileA, folderA]);
    const names = result.map(n => n.name);
    // folders first (alpha, xray), then files (alpha.txt, beta.txt)
    expect(names).toEqual(['alpha', 'xray', 'alpha.txt', 'beta.txt']);
  });

  it('sorts by name descending — folders still first', () => {
    const sort = makeSortNodes('name', 'desc');
    const result = sort([fileB, folderX, fileA, folderA]);
    const names = result.map(n => n.name);
    expect(names).toEqual(['xray', 'alpha', 'beta.txt', 'alpha.txt']);
  });

  it('sorts by size ascending', () => {
    const sort = makeSortNodes('size', 'asc');
    const result = sort([fileC, fileA, fileB]);
    const sizes = result.map(n => n.size);
    expect(sizes).toEqual([50, 100, 200]);
  });

  it('sorts by size descending', () => {
    const sort = makeSortNodes('size', 'desc');
    const result = sort([fileC, fileA, fileB]);
    const sizes = result.map(n => n.size);
    expect(sizes).toEqual([200, 100, 50]);
  });

  it('sorts by modified ascending', () => {
    const sort = makeSortNodes('modified', 'asc');
    const result = sort([fileC, fileB, fileA]);
    const mods = result.map(n => n.lastModified);
    expect(mods).toEqual(['2024-01-01', '2024-03-01', '2024-06-01']);
  });

  it('sorts by modified descending', () => {
    const sort = makeSortNodes('modified', 'desc');
    const result = sort([fileC, fileB, fileA]);
    const mods = result.map(n => n.lastModified);
    expect(mods).toEqual(['2024-06-01', '2024-03-01', '2024-01-01']);
  });

  it('recursively sorts children', () => {
    const child1 = makeNode('z.txt', false, 10, '');
    const child2 = makeNode('a.txt', false, 20, '');
    const folder = makeNode('folder', true, 0, '', [child1, child2]);
    const sort = makeSortNodes('name', 'asc');
    const result = sort([folder]);
    expect(result[0].children!.map(c => c.name)).toEqual(['a.txt', 'z.txt']);
  });

  it('folders always come before files regardless of sort field', () => {
    const sort = makeSortNodes('size', 'desc');
    const bigFile = makeNode('huge.zip', false, 99999, '');
    const emptyFolder = makeNode('empty', true, 0, '', []);
    const result = sort([bigFile, emptyFolder]);
    expect(result[0].isFolder).toBe(true);
    expect(result[1].isFolder).toBe(false);
  });
});

describe('computeFolderSize', () => {
  it('sums child sizes recursively', () => {
    const child = makeNode('a.txt', false, 100, '');
    const nested = makeNode('sub', true, 0, '', [makeNode('b.txt', false, 200, '')]);
    const folder = makeNode('root', true, 0, '', [child, nested]);
    expect(computeFolderSize(folder)).toBe(300);
  });

  it('returns 0 for empty folder', () => {
    const folder = makeNode('empty', true, 0, '', []);
    expect(computeFolderSize(folder)).toBe(0);
  });

  it('returns 0 for folder with no children loaded', () => {
    const folder = makeNode('unloaded', true);
    expect(computeFolderSize(folder)).toBe(0);
  });
});

describe('computeFolderLastModified', () => {
  it('returns latest date from descendants', () => {
    const folder = makeNode('root', true, 0, '', [
      makeNode('old.txt', false, 10, '2024-01-01'),
      makeNode('new.txt', false, 10, '2024-12-31'),
    ]);
    expect(computeFolderLastModified(folder)).toBe('2024-12-31');
  });

  it('returns empty string for folder with no children', () => {
    const folder = makeNode('empty', true, 0, '', []);
    expect(computeFolderLastModified(folder)).toBe('');
  });
});
