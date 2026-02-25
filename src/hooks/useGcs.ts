import { useState, useCallback, useRef } from 'react';
import { getErrorMessage } from '../utils/format';

export interface GcsConfig {
  serviceUrl: string;
  bucketName: string;
  accessId: string;
  secret: string;
  basePath: string;
  timeout: number;
}

export interface GcsObject {
  key: string;
  size: number;
  lastModified: string;
}

export interface ListResult {
  objects: GcsObject[];
  folders: string[];
}

export interface TreeNode {
  name: string;
  fullPath: string;
  isFolder: boolean;
  size: number;
  lastModified: string;
  children?: TreeNode[];
  childrenLoaded: boolean;
}

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

async function prefetchChildren(nodes: TreeNode[]): Promise<void> {
  const folders = nodes.filter(n => n.isFolder);
  await Promise.all(folders.map(async (node) => {
    try {
      const childResult = await window.gcsApi.list(node.fullPath);
      node.children = buildTreeNodes(childResult);
      node.childrenLoaded = true;
    } catch {
      // leave as not loaded
    }
  }));
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

async function refreshChildren(prefix: string): Promise<TreeNode[]> {
  const result = await window.gcsApi.list(prefix);
  const children = buildTreeNodes(result);
  await prefetchChildren(children);
  return children;
}

export function useGcs() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPrefix, setCurrentPrefix] = useState('');
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const expandingRef = useRef(false);

  const connect = useCallback(async (config: GcsConfig): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const result = await window.gcsApi.connect(config);
      if (result.success) {
        setConnected(true);
        const prefix = config.basePath ? config.basePath + '/' : '';
        setCurrentPrefix(prefix);
        const listResult = await window.gcsApi.list(prefix);
        const nodes = buildTreeNodes(listResult);
        await prefetchChildren(nodes);
        setTreeData(nodes);
        setExpandedPaths(new Set());
        return true;
      } else {
        setError(result.error || 'Connection failed');
        return false;
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshList = useCallback(async (prefix?: string) => {
    setLoading(true);
    setError(null);
    try {
      const p = prefix ?? currentPrefix;
      const nodes = await refreshChildren(p);
      if (prefix !== undefined) {
        setCurrentPrefix(p);
        setExpandedPaths(new Set());
      }
      setTreeData(nodes);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [currentPrefix]);

  const navigateTo = useCallback(async (prefix: string) => {
    await refreshList(prefix);
  }, [refreshList]);

  const uploadFiles = useCallback(async (targetPrefix?: string) => {
    setError(null);
    const filePaths = await window.gcsApi.openFileDialog();
    if (!filePaths) return;

    const dest = targetPrefix ?? currentPrefix;
    setLoading(true);
    try {
      for (const filePath of filePaths) {
        const fileName = filePath.replace(/\\/g, '/').split('/').pop()!;
        const key = dest + fileName;
        await window.gcsApi.upload(key, filePath);
      }
      if (targetPrefix && targetPrefix !== currentPrefix) {
        const children = await refreshChildren(targetPrefix);
        setTreeData(prev => updateNodeChildren(prev, targetPrefix, children));
        setExpandedPaths(prev => { const next = new Set(prev); next.add(targetPrefix); return next; });
      } else {
        await refreshList();
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [currentPrefix, refreshList]);

  const downloadFile = useCallback(async (key: string) => {
    setError(null);
    const fileName = key.split('/').pop() || 'download';
    const savePath = await window.gcsApi.saveFileDialog(fileName);
    if (!savePath) return;

    setLoading(true);
    try {
      await window.gcsApi.download(key, savePath);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const deleteFiles = useCallback(async (keys: string[]) => {
    setLoading(true);
    setError(null);
    try {
      for (const key of keys) {
        await window.gcsApi.delete(key);
      }
      await refreshList();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [refreshList]);

  const moveFile = useCallback(async (sourceKey: string, destKey: string) => {
    setLoading(true);
    setError(null);
    try {
      await window.gcsApi.move(sourceKey, destKey);
      await refreshList();
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [refreshList]);

  const createFolder = useCallback(async (folderName: string, targetPrefix?: string) => {
    setLoading(true);
    setError(null);
    const dest = targetPrefix ?? currentPrefix;
    try {
      const key = dest + folderName + '/';
      await window.gcsApi.createFolder(key);
      if (targetPrefix && targetPrefix !== currentPrefix) {
        const children = await refreshChildren(targetPrefix);
        setTreeData(prev => updateNodeChildren(prev, targetPrefix, children));
        setExpandedPaths(prev => { const next = new Set(prev); next.add(targetPrefix); return next; });
      } else {
        await refreshList();
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [currentPrefix, refreshList]);

  const createSubfolder = useCallback(async (parentPrefix: string, folderName: string) => {
    setLoading(true);
    setError(null);
    try {
      const key = parentPrefix + folderName + '/';
      await window.gcsApi.createFolder(key);
      const children = await refreshChildren(parentPrefix);
      setTreeData(prev => updateNodeChildren(prev, parentPrefix, children));
      setExpandedPaths(prev => { const next = new Set(prev); next.add(parentPrefix); return next; });
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleFolder = useCallback(async (prefix: string) => {
    if (expandedPaths.has(prefix)) {
      setExpandedPaths(prev => {
        const next = new Set(prev);
        next.delete(prefix);
        return next;
      });
      return;
    }

    const node = findNode(treeData, prefix);

    if (node && !node.childrenLoaded) {
      setLoading(true);
      try {
        const children = await refreshChildren(prefix);
        setTreeData(prev => updateNodeChildren(prev, prefix, children));
      } catch (err: unknown) {
        setError(getErrorMessage(err));
        setLoading(false);
        return;
      } finally {
        setLoading(false);
      }
    } else if (node?.children) {
      const unprefetched = node.children.filter(c => c.isFolder && !c.childrenLoaded);
      if (unprefetched.length > 0) {
        setLoading(true);
        try {
          await prefetchChildren(node.children);
          setTreeData(prev => updateNodeChildren(prev, prefix, [...node.children!]));
        } catch (err: unknown) {
          setError(getErrorMessage(err));
        } finally {
          setLoading(false);
        }
      }
    }

    setExpandedPaths(prev => {
      const next = new Set(prev);
      next.add(prefix);
      return next;
    });
  }, [expandedPaths, treeData]);

  const expandAllRecursive = useCallback(async (nodes: TreeNode[], expanded: Set<string>) => {
    for (const node of nodes) {
      if (!node.isFolder) continue;
      expanded.add(node.fullPath);

      if (!node.childrenLoaded) {
        try {
          const result = await window.gcsApi.list(node.fullPath);
          node.children = buildTreeNodes(result);
          node.childrenLoaded = true;
        } catch {
          continue;
        }
      }

      if (node.children && node.children.length > 0) {
        await expandAllRecursive(node.children, expanded);
      }
    }
  }, []);

  const expandAll = useCallback(async () => {
    if (expandingRef.current) return;
    expandingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      const cloned = JSON.parse(JSON.stringify(treeData)) as TreeNode[];
      const expanded = new Set<string>();
      await expandAllRecursive(cloned, expanded);
      setTreeData(cloned);
      setExpandedPaths(expanded);
    } catch (err: unknown) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      expandingRef.current = false;
    }
  }, [treeData, expandAllRecursive]);

  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set());
  }, []);

  return {
    connected,
    loading,
    error,
    currentPrefix,
    treeData,
    expandedPaths,
    connect,
    refreshList,
    navigateTo,
    uploadFiles,
    downloadFile,
    deleteFiles,
    moveFile,
    createFolder,
    createSubfolder,
    toggleFolder,
    expandAll,
    collapseAll,
  };
}
