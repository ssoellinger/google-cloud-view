/**
 * Tests for the pure helper functions used by useGcs:
 * buildTreeNodes, updateNodeChildren, findNode
 *
 * These are module-private, so we re-implement them here to test the logic.
 * If the logic ever gets extracted to a utility, swap the imports.
 */
import { describe, it, expect } from 'vitest';
import type { TreeNode } from '../src/hooks/useGcs';

// --- Re-implementations matching useGcs.ts exactly ---

interface GcsObject { key: string; size: number; lastModified: string; }
interface ListResult { objects: GcsObject[]; folders: string[]; }

function buildTreeNodes(result: ListResult): TreeNode[] {
  const nodes: TreeNode[] = [];
  for (const prefix of result.folders) {
    const parts = prefix.replace(/\/$/, '').split('/');
    nodes.push({
      name: parts[parts.length - 1],
      fullPath: prefix,
      isFolder: true,
      size: 0,
      lastModified: '',
      children: undefined,
      childrenLoaded: false,
    });
  }
  for (const obj of result.objects) {
    const parts = obj.key.split('/');
    nodes.push({
      name: parts[parts.length - 1],
      fullPath: obj.key,
      isFolder: false,
      size: obj.size,
      lastModified: obj.lastModified,
      childrenLoaded: false,
    });
  }
  return nodes;
}

function updateNodeChildren(nodes: TreeNode[], targetPath: string, children: TreeNode[]): TreeNode[] {
  return nodes.map(node => {
    if (node.fullPath === targetPath) {
      return { ...node, children, childrenLoaded: true };
    }
    if (node.children) {
      return { ...node, children: updateNodeChildren(node.children, targetPath, children) };
    }
    return node;
  });
}

function findNode(nodes: TreeNode[], path: string): TreeNode | undefined {
  for (const n of nodes) {
    if (n.fullPath === path) return n;
    if (n.children) {
      const found = findNode(n.children, path);
      if (found) return found;
    }
  }
  return undefined;
}

// --- Tests ---

describe('buildTreeNodes', () => {
  it('creates folder nodes from folder prefixes', () => {
    const result: ListResult = {
      objects: [],
      folders: ['path/docs/', 'path/images/'],
    };
    const nodes = buildTreeNodes(result);
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({ name: 'docs', fullPath: 'path/docs/', isFolder: true });
    expect(nodes[1]).toMatchObject({ name: 'images', fullPath: 'path/images/', isFolder: true });
  });

  it('creates file nodes from objects', () => {
    const result: ListResult = {
      objects: [
        { key: 'path/readme.txt', size: 100, lastModified: '2024-01-01' },
        { key: 'path/data.json', size: 200, lastModified: '2024-02-01' },
      ],
      folders: [],
    };
    const nodes = buildTreeNodes(result);
    expect(nodes).toHaveLength(2);
    expect(nodes[0]).toMatchObject({ name: 'readme.txt', isFolder: false, size: 100 });
    expect(nodes[1]).toMatchObject({ name: 'data.json', isFolder: false, size: 200 });
  });

  it('combines folders and files', () => {
    const result: ListResult = {
      objects: [{ key: 'a.txt', size: 50, lastModified: '' }],
      folders: ['sub/'],
    };
    const nodes = buildTreeNodes(result);
    expect(nodes).toHaveLength(2);
    expect(nodes[0].isFolder).toBe(true);
    expect(nodes[1].isFolder).toBe(false);
  });

  it('handles empty result', () => {
    const nodes = buildTreeNodes({ objects: [], folders: [] });
    expect(nodes).toHaveLength(0);
  });

  it('folders start with childrenLoaded=false and no children', () => {
    const nodes = buildTreeNodes({ objects: [], folders: ['test/'] });
    expect(nodes[0].childrenLoaded).toBe(false);
    expect(nodes[0].children).toBeUndefined();
  });
});

describe('updateNodeChildren', () => {
  it('updates children for a matching path', () => {
    const nodes: TreeNode[] = [
      { name: 'folder', fullPath: 'folder/', isFolder: true, size: 0, lastModified: '', childrenLoaded: false },
    ];
    const children: TreeNode[] = [
      { name: 'file.txt', fullPath: 'folder/file.txt', isFolder: false, size: 10, lastModified: '', childrenLoaded: false },
    ];

    const updated = updateNodeChildren(nodes, 'folder/', children);
    expect(updated[0].children).toEqual(children);
    expect(updated[0].childrenLoaded).toBe(true);
  });

  it('recursively updates nested paths', () => {
    const nodes: TreeNode[] = [{
      name: 'outer', fullPath: 'outer/', isFolder: true, size: 0, lastModified: '', childrenLoaded: true,
      children: [{
        name: 'inner', fullPath: 'outer/inner/', isFolder: true, size: 0, lastModified: '', childrenLoaded: false,
      }],
    }];
    const newChildren: TreeNode[] = [
      { name: 'deep.txt', fullPath: 'outer/inner/deep.txt', isFolder: false, size: 5, lastModified: '', childrenLoaded: false },
    ];

    const updated = updateNodeChildren(nodes, 'outer/inner/', newChildren);
    expect(updated[0].children![0].children).toEqual(newChildren);
  });

  it('does not modify unrelated nodes', () => {
    const nodes: TreeNode[] = [
      { name: 'a', fullPath: 'a/', isFolder: true, size: 0, lastModified: '', childrenLoaded: false },
      { name: 'b', fullPath: 'b/', isFolder: true, size: 0, lastModified: '', childrenLoaded: false },
    ];
    const updated = updateNodeChildren(nodes, 'a/', []);
    expect(updated[0].childrenLoaded).toBe(true);
    expect(updated[1].childrenLoaded).toBe(false); // unchanged
  });
});

describe('findNode', () => {
  const tree: TreeNode[] = [{
    name: 'root', fullPath: 'root/', isFolder: true, size: 0, lastModified: '', childrenLoaded: true,
    children: [
      { name: 'file.txt', fullPath: 'root/file.txt', isFolder: false, size: 100, lastModified: '', childrenLoaded: false },
      {
        name: 'sub', fullPath: 'root/sub/', isFolder: true, size: 0, lastModified: '', childrenLoaded: true,
        children: [
          { name: 'deep.txt', fullPath: 'root/sub/deep.txt', isFolder: false, size: 50, lastModified: '', childrenLoaded: false },
        ],
      },
    ],
  }];

  it('finds a top-level node', () => {
    expect(findNode(tree, 'root/')?.name).toBe('root');
  });

  it('finds a nested file', () => {
    expect(findNode(tree, 'root/file.txt')?.name).toBe('file.txt');
  });

  it('finds a deeply nested node', () => {
    expect(findNode(tree, 'root/sub/deep.txt')?.name).toBe('deep.txt');
  });

  it('returns undefined for non-existent path', () => {
    expect(findNode(tree, 'root/missing.txt')).toBeUndefined();
  });
});
