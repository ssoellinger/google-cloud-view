import { useState } from 'react';
import type { TreeNode } from '../hooks/useGcs';
import { Breadcrumb } from './Breadcrumb';
import { Toolbar } from './Toolbar';
import { FileRow } from './FileRow';

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
  onCreateFolder: (name: string, targetPrefix?: string) => void;
  onCreateSubfolder: (parentPrefix: string, folderName: string) => void;
  onDisconnect: () => void;
  onToggleFolder: (prefix: string) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
}

export function FileBrowser({
  treeData, expandedPaths, currentPrefix, loading, error,
  onNavigate, onUpload, onRefresh, onDownload, onDelete, onMove, onCreateFolder,
  onCreateSubfolder, onDisconnect, onToggleFolder, onExpandAll, onCollapseAll,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    const sourceKey = e.dataTransfer.getData('text/plain');
    if (!sourceKey) return;
    const fileName = sourceKey.replace(/\/$/, '').split('/').pop()!;
    const isSourceFolder = sourceKey.endsWith('/');
    const destKey = currentPrefix + fileName + (isSourceFolder ? '/' : '');
    if (sourceKey !== destKey) {
      onMove(sourceKey, destKey);
    }
  };

  const handleTableDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const allSelected = visibleKeys.length > 0 && selected.size === visibleKeys.length;

  const selectedFolders = Array.from(selected).filter(k => k.endsWith('/'));
  const targetPrefix = selectedFolders.length === 1 ? selectedFolders[0] : undefined;
  const targetLabel = targetPrefix
    ? targetPrefix.replace(/\/$/, '').split('/').pop()!
    : undefined;

  const renderTree = (nodes: TreeNode[], depth: number): React.ReactNode[] => {
    const rows: React.ReactNode[] = [];
    const folders = nodes.filter(n => n.isFolder);
    const files = nodes.filter(n => !n.isFolder);

    for (const node of [...folders, ...files]) {
      const isExpanded = expandedPaths.has(node.fullPath);
      rows.push(
        <FileRow
          key={node.fullPath}
          name={node.name}
          objectKey={node.fullPath}
          size={node.size}
          lastModified={node.lastModified}
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
          onCreateSubfolder={node.isFolder ? onCreateSubfolder : undefined}
        />
      );
      if (node.isFolder && isExpanded && node.children) {
        rows.push(...renderTree(node.children, depth + 1));
      }
    }
    return rows;
  };

  return (
    <div style={styles.container}>
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
      />
      {confirmDelete && (
        <div style={styles.confirmBar}>
          <span>Delete <strong>{selected.size}</strong> item(s)? Click "Delete Selected" again to confirm.</span>
          <button style={styles.cancelBtn} onClick={() => setConfirmDelete(false)}>Cancel</button>
        </div>
      )}
      {error && <div style={styles.error}>{error}</div>}
      {loading && <div style={styles.spinner}>Loading...</div>}
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
              <th style={{ ...styles.th, ...styles.nameCol }}>Name</th>
              <th style={styles.th}>Size</th>
              <th style={styles.th}>Modified</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {renderTree(treeData, 0)}
            {!loading && treeData.length === 0 && (
              <tr>
                <td colSpan={5} style={styles.empty}>
                  <div style={{ fontSize: 32, marginBottom: 8, color: '#dfe6e9' }}>&#128193;</div>
                  This folder is empty
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
