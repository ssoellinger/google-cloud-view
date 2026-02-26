/**
 * Tests for the search/filter logic used in FileBrowser.
 */
import { describe, it, expect } from 'vitest';
import type { TreeNode } from '../src/hooks/useGcs';

function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  if (!query) return nodes;
  const lowerQuery = query.toLowerCase();
  return nodes.reduce<TreeNode[]>((acc, node) => {
    const nameMatch = node.name.toLowerCase().includes(lowerQuery);
    if (node.isFolder) {
      const filteredChildren = node.children ? filterTree(node.children, query) : [];
      if (nameMatch || filteredChildren.length > 0) {
        acc.push({ ...node, children: filteredChildren.length > 0 ? filteredChildren : node.children });
      }
    } else if (nameMatch) {
      acc.push(node);
    }
    return acc;
  }, []);
}

function makeNode(name: string, isFolder: boolean, children?: TreeNode[]): TreeNode {
  return {
    name,
    fullPath: isFolder ? name + '/' : name,
    isFolder,
    size: 0,
    lastModified: '',
    children,
    childrenLoaded: !!children,
  };
}

describe('filterTree', () => {
  it('returns all nodes when query is empty', () => {
    const nodes = [makeNode('a.txt', false), makeNode('b.txt', false)];
    expect(filterTree(nodes, '')).toEqual(nodes);
  });

  it('filters files by name (case-insensitive)', () => {
    const nodes = [
      makeNode('readme.txt', false),
      makeNode('data.json', false),
      makeNode('README.md', false),
    ];
    const result = filterTree(nodes, 'readme');
    expect(result.map(n => n.name)).toEqual(['readme.txt', 'README.md']);
  });

  it('keeps folders that match by name', () => {
    const folder = makeNode('docs', true, [makeNode('unrelated.txt', false)]);
    const result = filterTree([folder], 'docs');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('docs');
  });

  it('keeps folders with matching descendants', () => {
    const folder = makeNode('stuff', true, [
      makeNode('readme.txt', false),
      makeNode('other.bin', false),
    ]);
    const result = filterTree([folder], 'readme');
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('stuff');
    expect(result[0].children!.map(c => c.name)).toEqual(['readme.txt']);
  });

  it('removes folders with no matching descendants', () => {
    const folder = makeNode('empty', true, [makeNode('nothing.bin', false)]);
    const result = filterTree([folder], 'readme');
    expect(result).toHaveLength(0);
  });

  it('handles deeply nested matches', () => {
    const tree = [
      makeNode('level1', true, [
        makeNode('level2', true, [
          makeNode('target.txt', false),
        ]),
      ]),
    ];
    const result = filterTree(tree, 'target');
    expect(result).toHaveLength(1);
    expect(result[0].children![0].children![0].name).toBe('target.txt');
  });

  it('partial name matching works', () => {
    const nodes = [
      makeNode('application.js', false),
      makeNode('config.js', false),
      makeNode('app.ts', false),
    ];
    const result = filterTree(nodes, 'app');
    expect(result.map(n => n.name)).toEqual(['application.js', 'app.ts']);
  });

  it('returns empty array when nothing matches', () => {
    const nodes = [makeNode('a.txt', false), makeNode('b.txt', false)];
    expect(filterTree(nodes, 'zzz')).toEqual([]);
  });

  it('handles folders with no children loaded', () => {
    const folder: TreeNode = {
      name: 'unloaded',
      fullPath: 'unloaded/',
      isFolder: true,
      size: 0,
      lastModified: '',
      children: undefined,
      childrenLoaded: false,
    };
    // Folder name doesn't match, no children to search
    expect(filterTree([folder], 'test')).toEqual([]);
    // Folder name matches
    expect(filterTree([folder], 'unloaded')).toHaveLength(1);
  });
});
