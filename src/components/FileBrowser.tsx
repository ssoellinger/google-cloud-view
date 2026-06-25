import { useState, useRef, useEffect } from 'react';
import type { TreeNode } from '../hooks/useGcs';
import { getErrorMessage } from '../utils/format';
import { Breadcrumb } from './Breadcrumb';
import { Toolbar } from './Toolbar';
import { FileRow } from './FileRow';
import { ProgressBar } from './ProgressBar';
import { HelpModal } from './HelpModal';
import { PreviewModal } from './PreviewModal';
import { Logo } from './Logo';

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
  onDownloadSelected: (keys: string[]) => Promise<boolean>;
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
  onNavigate, onUpload, onRefresh, onDownload, onDownloadSelected, onDelete, onMove, onCopy, onDuplicate, onCreateFolder,
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
  const [showHelp, setShowHelp] = useState(false);
  const [preview, setPreview] = useState<{ key: string; name: string; size: number } | null>(null);
  const [searchResults, setSearchResults] = useState<{ key: string; size: number; lastModified: string }[] | null>(null);
  const [searchTruncated, setSearchTruncated] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [renamingKey, setRenamingKey] = useState<string | null>(null);

  // Navigating away exits server-side search mode and drops the (now out-of-view) selection
  useEffect(() => {
    setSearchResults(null);
    setSearchError(null);
    setSelected(new Set());
  }, [currentPrefix]);

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

  // Latest state/handlers for the global keyboard listener (avoids stale closures)
  const kbStateRef = useRef<{
    modalOpen: boolean;
    selectedSize: number;
    confirmDelete: boolean;
    searchActive: boolean;
    selectAll: (checked: boolean) => void;
    doDelete: () => void;
    cancelConfirm: () => void;
    clearSelection: () => void;
    clearSearch: () => void;
    activateSelected: () => void;
    startRename: () => void;
  } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = kbStateRef.current;
      if (!s || s.modalOpen) return; // let open modals handle their own keys
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;

      if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        s.selectAll(true);
      } else if (e.key === 'Delete' && s.selectedSize > 0) {
        e.preventDefault();
        s.doDelete();
      } else if (e.key === 'Escape') {
        if (s.confirmDelete) s.cancelConfirm();
        else if (s.selectedSize > 0) s.clearSelection();
        else if (s.searchActive) s.clearSearch();
      } else if (e.key === 'Enter' && s.selectedSize === 1) {
        e.preventDefault();
        s.activateSelected();
      } else if (e.key === 'F2' && s.selectedSize === 1) {
        e.preventDefault();
        s.startRename();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
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
      // Guard against missing fields (e.g. an object without LastModified) — a
      // bare .localeCompare on undefined would throw and blank the whole view.
      if (sortField === 'name') {
        cmp = (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      } else if (sortField === 'size') {
        const sizeA = a.isFolder ? computeFolderSize(a) : a.size;
        const sizeB = b.isFolder ? computeFolderSize(b) : b.size;
        cmp = (sizeA || 0) - (sizeB || 0);
      } else {
        const modA = a.isFolder ? computeFolderLastModified(a) : a.lastModified;
        const modB = b.isFolder ? computeFolderLastModified(b) : b.lastModified;
        cmp = (modA || '').localeCompare(modB || '');
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

  const anchorIndexRef = useRef<number | null>(null);

  // Visible rows in the exact order they render (sorted + search-filtered), so
  // range-select and select-all operate on what the user actually sees.
  const renderedRoots = sortNodes(filterTree(treeData, searchQuery.trim()));
  const collectRenderedKeys = (nodes: TreeNode[]): string[] => {
    const keys: string[] = [];
    for (const node of nodes) {
      keys.push(node.fullPath);
      if (node.isFolder && (expandedPaths.has(node.fullPath) || isSearchActive) && node.children) {
        keys.push(...collectRenderedKeys(node.children));
      }
    }
    return keys;
  };
  // In server-search mode, selection/select-all operate on the flat result set
  const visibleKeys = searchResults !== null ? searchResults.map(r => r.key) : collectRenderedKeys(renderedRoots);

  const handleSearchChange = (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) { setSearchResults(null); setSearchError(null); }
  };

  const handleSearchSubmit = async () => {
    const q = searchQuery.trim();
    if (!q) { setSearchResults(null); return; }
    // Switching into the flat result set: drop the tree selection so it can't act invisibly
    setSelected(new Set());
    anchorIndexRef.current = null;
    setSearching(true);
    setSearchError(null);
    try {
      const { results, truncated } = await window.gcsApi.search(currentPrefix, q);
      setSearchResults(results);
      setSearchTruncated(truncated);
    } catch (e: unknown) {
      setSearchResults([]);
      setSearchError(getErrorMessage(e));
    } finally {
      setSearching(false);
    }
  };

  const handleSelect = (key: string, checked: boolean, shiftKey: boolean) => {
    const idx = visibleKeys.indexOf(key);
    if (shiftKey && anchorIndexRef.current !== null && idx !== -1) {
      // Apply the clicked checkbox's new state across the whole range
      const [from, to] = anchorIndexRef.current <= idx
        ? [anchorIndexRef.current, idx]
        : [idx, anchorIndexRef.current];
      const range = visibleKeys.slice(from, to + 1);
      setSelected(prev => {
        const next = new Set(prev);
        for (const k of range) { if (checked) next.add(k); else next.delete(k); }
        return next;
      });
    } else {
      setSelected(prev => {
        const next = new Set(prev);
        if (checked) next.add(key); else next.delete(key);
        return next;
      });
    }
    if (idx !== -1) anchorIndexRef.current = idx;
  };

  const handleSelectAll = (checked: boolean) => {
    setSelected(checked ? new Set(visibleKeys) : new Set());
  };

  const handleDownloadSelected = async () => {
    if (selected.size === 0) return;
    const downloaded = await onDownloadSelected(Array.from(selected));
    if (downloaded) setSelected(new Set()); // keep the selection if the save dialog was cancelled
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
    const sourceParent = sourceKey.replace(/\/?$/, '').includes('/')
      ? sourceKey.replace(/\/?$/, '').split('/').slice(0, -1).join('/') + '/'
      : '';
    // Only move if dropping into a different directory than the source's parent
    if (sourceParent === currentPrefix) return;
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

  const findNode = (nodes: TreeNode[], path: string): TreeNode | undefined => {
    for (const n of nodes) {
      if (n.fullPath === path) return n;
      if (n.children) {
        const found = findNode(n.children, path);
        if (found) return found;
      }
    }
    return undefined;
  };

  // Keep the keyboard listener's view of state/handlers current on every render
  kbStateRef.current = {
    modalOpen: !!preview || showHelp,
    selectedSize: selected.size,
    confirmDelete,
    searchActive: searchQuery.trim().length > 0,
    selectAll: handleSelectAll,
    doDelete: handleDelete,
    cancelConfirm: () => setConfirmDelete(false),
    clearSelection: () => setSelected(new Set()),
    clearSearch: () => setSearchQuery(''),
    activateSelected: () => {
      const key = Array.from(selected)[0];
      if (!key) return;
      if (key.endsWith('/')) { onToggleFolder(key); return; }
      const node = findNode(treeData, key);
      if (node) setPreview({ key: node.fullPath, name: node.name, size: node.size });
    },
    startRename: () => {
      const key = Array.from(selected)[0];
      if (key) setRenamingKey(key);
    },
  };

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
          onPreview={node.isFolder ? undefined : () => setPreview({ key: node.fullPath, name: node.name, size: node.size })}
          shouldRename={renamingKey === node.fullPath}
          onRenameConsumed={() => setRenamingKey(null)}
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
        <div style={styles.headerLeft}>
          <Logo size={28} />
          <Breadcrumb prefix={currentPrefix} onNavigate={onNavigate} />
        </div>
        <div style={styles.headerActions}>
          <button style={styles.helpBtn} onClick={() => setShowHelp(true)} title="How drag & drop and the other actions work">
            <span style={styles.helpIcon}>?</span> Help
          </button>
          <button style={styles.disconnectBtn} onClick={onDisconnect}>Disconnect</button>
        </div>
      </div>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {preview && (
        <PreviewModal
          objectKey={preview.key}
          name={preview.name}
          size={preview.size}
          onClose={() => setPreview(null)}
          onDownload={() => { onDownload(preview.key); setPreview(null); }}
        />
      )}
      <Toolbar
        onUpload={() => onUpload(targetPrefix)}
        onRefresh={onRefresh}
        onDownloadSelected={handleDownloadSelected}
        onDelete={handleDelete}
        selectionCount={selected.size}
        onCreateFolder={(name) => onCreateFolder(name, targetPrefix)}
        hasSelection={selected.size > 0}
        loading={loading}
        onExpandAll={onExpandAll}
        onCollapseAll={onCollapseAll}
        targetFolderName={targetLabel}
        searchQuery={searchQuery}
        onSearchChange={handleSearchChange}
        onSearchSubmit={handleSearchSubmit}
      />
      {(searchResults !== null || searching) && (
        <div style={styles.searchBanner}>
          <span>
            {searching
              ? 'Searching the whole folder…'
              : `${searchResults!.length} match${searchResults!.length === 1 ? '' : 'es'} for "${searchQuery.trim()}"${searchTruncated ? ' (showing first 1000)' : ''}`}
          </span>
          <button style={styles.cancelBtn} onClick={() => { setSearchResults(null); setSearchError(null); setSearchQuery(''); setSelected(new Set()); }}>Clear search</button>
        </div>
      )}
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
            {searchResults !== null ? (
              <>
                {searchResults.map(r => (
                  <FileRow
                    key={r.key}
                    name={currentPrefix && r.key.startsWith(currentPrefix) ? r.key.slice(currentPrefix.length) : r.key}
                    objectKey={r.key}
                    size={r.size}
                    lastModified={r.lastModified}
                    isFolder={false}
                    isSelected={selected.has(r.key)}
                    currentPrefix={currentPrefix}
                    depth={0}
                    hasChildren={false}
                    onSelect={handleSelect}
                    onPreview={() => setPreview({ key: r.key, name: r.key.split('/').pop()!, size: r.size })}
                    onDownload={onDownload}
                    onMove={onMove}
                    onCopyToFolder={onCopy}
                    onDuplicate={onDuplicate}
                    onDismissDropZone={dismissDropZone}
                  />
                ))}
                {!searching && searchResults.length === 0 && (
                  <tr>
                    <td colSpan={5} style={styles.empty}>
                      <div style={{ fontSize: 32, marginBottom: 8, color: '#dfe6e9' }}>{'\uD83D\uDD0D'}</div>
                      {searchError ? 'Search failed: ' + searchError : 'No matches in this folder'}
                    </td>
                  </tr>
                )}
              </>
            ) : (
              <>
                {renderTree(renderedRoots, 0)}
                {!loading && (isSearchActive ? renderedRoots.length === 0 : treeData.length === 0) && (
                  <tr>
                    <td colSpan={5} style={styles.empty}>
                      <div style={{ fontSize: 32, marginBottom: 8, color: '#dfe6e9' }}>{isSearchActive ? '\uD83D\uDD0D' : '\uD83D\uDCC1'}</div>
                      {isSearchActive ? 'No matching items' : 'This folder is empty'}
                    </td>
                  </tr>
                )}
              </>
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
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 0,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  helpBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '6px 12px',
    background: '#fff',
    border: '1.5px solid #e0e4ea',
    borderRadius: 8,
    fontSize: 12,
    color: '#636e72',
    fontWeight: 500,
  },
  helpIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: '#6c5ce7',
    color: '#fff',
    fontSize: 11,
    fontWeight: 700,
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
    tableLayout: 'fixed',
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
  searchBanner: {
    padding: '8px 16px',
    background: '#eef0ff',
    borderRadius: 8,
    margin: '8px 0',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    color: '#4a3fb8',
    border: '1px solid #d6d0ff',
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
