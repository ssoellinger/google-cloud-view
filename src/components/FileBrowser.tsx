import { useState, useRef, useEffect } from 'react';
import type { TreeNode } from '../hooks/useGcs';
import { Breadcrumb } from './Breadcrumb';
import { Toolbar } from './Toolbar';
import { FileRow } from './FileRow';
import { ProgressBar } from './ProgressBar';

type SortField = 'name' | 'size' | 'modified';
type SortDirection = 'asc' | 'desc';

interface Props {
  treeData: TreeNode[];
  expandedPaths: Set<string>;
  currentPrefix: string;
  loading: boolean;
  error: string | null;
  onNavigate: (prefix: string) => void;
  onUpload: (targetPrefix?: string) => void;
  onRefresh: () => void;
  onDownload: (key: string) => void;
  onDelete: (keys: string[]) => void;
  onMove: (sourceKey: string, destKey: string) => void;
  onCopy: (sourceKey: string, destKey: string) => void;
  onDuplicate: (key: string) => void;
  onCreateFolder: (name: string, targetPrefix?: string) => void;
  onCreateSubfolder: (parentPrefix: string, folderName: string) => void;
  onUploadFromPaths: (paths: string[], targetPrefix?: string) => void;
  onDisconnect: () => void;
  onToggleFolder: (prefix: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export function FileBrowser({
  treeData, expandedPaths, currentPrefix, loading, error,
  onNavigate, onUpload, onRefresh, onDownload, onDelete, onMove, onCopy, onDuplicate, onCreateFolder,
  onCreateSubfolder, onUploadFromPaths, onDisconnect, onToggleFolder, onExpandAll, onCollapseAll,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropZone, setShowDropZone] = useState(false);
  const dragCounterRef = useRef(0);
  const [progress, setProgress] = useState<ProgressData | null>(null);

  // Prevent Chromium from navigating to dropped files when they land outside a handler
  useEffect(() => {
    const prevent = (e: Event) => e.preventDefault();
    window.addEventListener('dragover', prevent);
    window.addEventListener('drop', prevent);
    return () => {
      window.removeEventListener('dragover', prevent);
      window.removeEventListener('drop', prevent);
    };
  }, []);

  useEffect(() => {
    const handler = window.gcsApi.onProgress((data: ProgressData) => {
      if (data.percent >= 100) {
        // Keep showing 100% briefly, then clear
        setProgress(data);
        setTimeout(() => setProgress(null), 800);
      } else {
        setProgress(data);
      }
    });
    return () => window.gcsApi.removeProgressListener(handler);
  }, []);

  const handleContainerDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      dragCounterRef.current++;
      setShowDropZone(true);
    }
  };

  const handleContainerDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes('Files')) {
      dragCounterRef.current--;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setShowDropZone(false);
      }
    }
  };

  const handleContainerDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleContainerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current = 0;
    setShowDropZone(false);

    if (e.dataTransfer.types.includes('Files') && e.dataTransfer.files.length > 0) {
      const paths: string[] = [];
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        const p = window.gcsApi.getPathForFile(e.dataTransfer.files[i]);
        if (p) paths.push(p);
      }
      if (paths.length > 0) {
        onUploadFromPaths(paths);
      }
    }
  };

  const handleSortClick = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    const sorted = [...nodes].sort((a, b) => {
      // Folders always before files
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
      node.children
        ? { ...node, children: sortNodes(node.children) }
        : node
    );
  };

  const sortArrow = (field: SortField) =>
    sortField === field ? (sortDirection === 'asc' ? ' \u25B4' : ' \u25BE') : '';

  const filterTree = (nodes: TreeNode[], query: string): TreeNode[] => {
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
  };

  const isSearchActive = searchQuery.trim().length > 0;

  const dismissDropZone = () => {
    dragCounterRef.current = 0;
    setShowDropZone(false);
  };

  const handleSelect = (key: string, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (checked) next.add(key); else next.delete(key);
      return next;
    });
  };

  const collectVisibleKeys = (nodes: TreeNode[]): string[] => {
    const keys: string[] = [];
    for (const node of nodes) {
      keys.push(node.fullPath);
      if (node.isFolder && expandedPaths.has(node.fullPath) && node.children) {
        keys.push(...collectVisibleKeys(node.children));
      }
    }
    return keys;
  };

  const visibleKeys = collectVisibleKeys(treeData);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelected(new Set(visibleKeys));
    } else {
      setSelected(new Set());
    }
  };

  const handleDelete = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(Array.from(selected));
    setSelected(new Set());
    setConfirmDelete(false);
  };

  const handleTableDrop = (e: React.DragEvent) => {
    e.preventDefault();

    // External file drop handled by container handler
    if (e.dataTransfer.types.includes('Files') && e.dataTransfer.files.length > 0) return;

    const sourceKey = e.dataTransfer.getData('text/plain');
    if (!sourceKey) return;
    const fileName = sourceKey.replace(/\/$/, '').split('/').pop()!;
    const isSourceFolder = sourceKey.endsWith('/');
    const destKey = currentPrefix + fileName + (isSourceFolder ? '/' : '');
    if (sourceKey !== destKey) {
      if (e.ctrlKey) {
        onCopy(sourceKey, destKey);
      } else {
        onMove(sourceKey, destKey);
      }
    }
  };

  const handleTableDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
  };

  const allSelected = visibleKeys.length > 0 && selected.size === visibleKeys.length;

  const selectedFolders = Array.from(selected).filter(k => k.endsWith('/'));
  const targetPrefix = selectedFolders.length === 1 ? selectedFolders[0] : undefined;
  const targetLabel = targetPrefix
    ? targetPrefix.replace(/\/$/, '').split('/').pop()!
    : undefined;

  const computeFolderSize = (node: TreeNode): number => {
    if (!node.isFolder) return node.size;
    if (!node.children) return 0;
    return node.children.reduce((sum, child) => sum + computeFolderSize(child), 0);
  };

  const computeFolderLastModified = (node: TreeNode): string => {
    if (!node.isFolder) return node.lastModified;
    if (!node.children) return '';
    let latest = '';
    for (const child of node.children) {
      const childDate = child.isFolder ? computeFolderLastModified(child) : child.lastModified;
      if (childDate && childDate > latest) latest = childDate;
    }
    return latest;
  };

  const renderTree = (nodes: TreeNode[], depth: number): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];

    for (const node of nodes) {
      const isExpanded = expandedPaths.has(node.fullPath);
      rows.push(
        <FileRow
          key={node.fullPath}
          name={node.name}
          objectKey={node.fullPath}
          size={node.isFolder ? computeFolderSize(node) : node.size}
          lastModified={node.isFolder ? computeFolderLastModified(node) : node.lastModified}
          isFolder={node.isFolder}
          isSelected={selected.has(node.fullPath)}
          currentPrefix={currentPrefix}
          depth={depth}
          isExpanded={isExpanded}
          hasChildren={node.isFolder ? (node.childrenLoaded ? (node.children ?? []).length > 0 : undefined) : false}
          onToggleExpand={node.isFolder ? () => onToggleFolder(node.fullPath) : undefined}
          onSelect={handleSelect}
          onDownload={onDownload}
          onMove={onMove}
          onCopyToFolder={onCopy}
          onDuplicate={onDuplicate}
          onCreateSubfolder={node.isFolder ? onCreateSubfolder : undefined}
          onUploadToFolder={node.isFolder ? onUploadFromPaths : undefined}
          onDismissDropZone={dismissDropZone}
        />
      );
      if (node.isFolder && (isExpanded || isSearchActive) && node.children) {
        rows.push(...renderTree(node.children, depth + 1));
      }
    }
    return rows;
  };

  return (
    <div
      style={styles.container}
      onDragEnter={handleContainerDragEnter}
      onDragLeave={handleContainerDragLeave}
      onDragOver={handleContainerDragOver}
      onDrop={handleContainerDrop}
    >
      {showDropZone && (
        <div style={styles.dropOverlay}>
          <div style={styles.dropOverlayInner}>Drop files here to upload</div>
        </div>
      )}
      <div style={styles.header}>
        <Breadcrumb prefix={currentPrefix} onNavigate={onNavigate} />
        <button style={styles.disconnectBtn} onClick={onDisconnect}>Disconnect</button>
      </div>
      <Toolbar
        onUpload={() => onUpload(targetPrefix)}
        onRefresh={onRefresh}
        onDelete={handleDelete}
        onCreateFolder={(name) => onCreateFolder(name, targetPrefix)}
        hasSelection={selected.size > 0}
        loading={loading}
        onExpandAll={onExpandAll}
        onCollapseAll={onCollapseAll}
        targetFolderName={targetLabel}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />
      {confirmDelete && (
        <div style={styles.confirmBar}>
          <span>Delete <strong>{selected.size}</strong> item(s)? Click "Delete Selected" again to confirm.</span>
          <button style={styles.cancelBtn} onClick={() => setConfirmDelete(false)}>Cancel</button>
        </div>
      )}
      {progress && (
        <ProgressBar operation={progress.operation} fileName={progress.fileName} percent={progress.percent} />
      )}
      {error && <div style={styles.error}>{error}</div>}
      {loading && !progress && <div style={styles.spinner}>Loading...</div>}
      <div
        style={styles.tableWrap}
        onDragOver={handleTableDragOver}
        onDrop={handleTableDrop}
      >
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: 36 }}>
                <input type="checkbox" checked={allSelected} onChange={e => handleSelectAll(e.target.checked)} />
              </th>
              <th style={{ ...styles.th, ...styles.nameCol, ...styles.sortableTh }} onClick={() => handleSortClick('name')}>Name{sortArrow('name')}</th>
              <th style={{ ...styles.th, ...styles.sortableTh }} onClick={() => handleSortClick('size')}>Size{sortArrow('size')}</th>
              <th style={{ ...styles.th, ...styles.sortableTh }} onClick={() => handleSortClick('modified')}>Modified{sortArrow('modified')}</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {renderTree(sortNodes(filterTree(treeData, searchQuery.trim())), 0)}
            {!loading && (isSearchActive ? filterTree(treeData, searchQuery.trim()).length === 0 : treeData.length === 0) && (
              <tr>
                <td colSpan={5} style={styles.empty}>
                  <div style={{ fontSize: 32, marginBottom: 8, color: '#dfe6e9' }}>{isSearchActive ? '\uD83D\uDD0D' : '\uD83D\uDCC1'}</div>
                  {isSearchActive ? 'No matching items' : 'This folder is empty'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    padding: '0 20px',
    background: '#f5f6fa',
    position: 'relative',
  },
  dropOverlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(108, 92, 231, 0.08)',
    border: '3px dashed #6c5ce7',
    borderRadius: 12,
    zIndex: 100,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  dropOverlayInner: {
    fontSize: 18,
    fontWeight: 600,
    color: '#6c5ce7',
    background: '#fff',
    padding: '16px 32px',
    borderRadius: 10,
    boxShadow: '0 2px 12px rgba(108, 92, 231, 0.15)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
    borderBottom: '1px solid #eef0f4',
  },
  disconnectBtn: {
    padding: '6px 14px',
    background: '#fff',
    border: '1.5px solid #e0e4ea',
    borderRadius: 8,
    fontSize: 12,
    color: '#636e72',
    fontWeight: 500,
  },
  tableWrap: {
    flex: 1,
    overflow: 'auto',
    marginTop: 4,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '10px 14px',
    fontSize: 11,
    fontWeight: 700,
    color: '#b2bec3',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
    borderBottom: '2px solid #eef0f4',
    background: '#f5f6fa',
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
  nameCol: {
    width: '50%',
  },
  sortableTh: {
    cursor: 'pointer',
    userSelect: 'none',
  },
  error: {
    color: '#d63031',
    fontSize: 13,
    padding: '10px 14px',
    background: '#fff5f5',
    borderRadius: 8,
    margin: '8px 0',
    border: '1px solid #fab1a0',
    fontWeight: 500,
  },
  spinner: {
    padding: '12px 0',
    fontSize: 13,
    color: '#6c5ce7',
    fontWeight: 500,
  },
  empty: {
    padding: 40,
    textAlign: 'center',
    color: '#b2bec3',
    fontSize: 14,
  },
  confirmBar: {
    padding: '10px 16px',
    background: '#ffeaa7',
    borderRadius: 8,
    margin: '8px 0',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    color: '#636e72',
    border: '1px solid #fdcb6e',
  },
  cancelBtn: {
    padding: '5px 12px',
    border: '1.5px solid #fdcb6e',
    borderRadius: 6,
    fontSize: 12,
    background: '#fff',
    color: '#636e72',
    fontWeight: 500,
  },
};
