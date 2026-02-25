import { useState } from 'react';
import type { GcsObject, ListResult } from '../hooks/useGcs';
import { Breadcrumb } from './Breadcrumb';
import { Toolbar } from './Toolbar';
import { FileRow } from './FileRow';

interface Props {
  items: ListResult;
  currentPrefix: string;
  loading: boolean;
  error: string | null;
  onNavigate: (prefix: string) => void;
  onUpload: () => void;
  onRefresh: () => void;
  onDownload: (key: string) => void;
  onDelete: (keys: string[]) => void;
  onRename: (oldKey: string, newKey: string) => void;
  onCreateFolder: (name: string) => void;
  onDisconnect: () => void;
}

export function FileBrowser({
  items, currentPrefix, loading, error,
  onNavigate, onUpload, onRefresh, onDownload, onDelete, onRename, onCreateFolder, onDisconnect,
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const all = new Set([
        ...items.folders,
        ...items.objects.map(o => o.key),
      ]);
      setSelected(all);
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

  const totalItems = items.folders.length + items.objects.length;
  const allSelected = totalItems > 0 && selected.size === totalItems;

  // Extract display name from a folder prefix
  const folderName = (prefix: string) => {
    const parts = prefix.replace(/\/$/, '').split('/');
    return parts[parts.length - 1];
  };

  // Extract display name from an object key
  const objectName = (key: string) => {
    const parts = key.split('/');
    return parts[parts.length - 1];
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <Breadcrumb prefix={currentPrefix} onNavigate={onNavigate} />
        <button style={styles.disconnectBtn} onClick={onDisconnect}>Disconnect</button>
      </div>
      <Toolbar
        onUpload={onUpload}
        onRefresh={onRefresh}
        onDelete={handleDelete}
        onCreateFolder={onCreateFolder}
        hasSelection={selected.size > 0}
        loading={loading}
      />
      {confirmDelete && (
        <div style={styles.confirmBar}>
          Delete {selected.size} item(s)? Click "Delete Selected" again to confirm.
          <button style={styles.cancelBtn} onClick={() => setConfirmDelete(false)}>Cancel</button>
        </div>
      )}
      {error && <div style={styles.error}>{error}</div>}
      {loading && <div style={styles.spinner}>Loading...</div>}
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>
                <input type="checkbox" checked={allSelected} onChange={e => handleSelectAll(e.target.checked)} />
              </th>
              <th style={{ ...styles.th, ...styles.nameCol }}>Name</th>
              <th style={styles.th}>Size</th>
              <th style={styles.th}>Modified</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.folders.map(prefix => (
              <FileRow
                key={prefix}
                name={folderName(prefix)}
                objectKey={prefix}
                size={0}
                lastModified=""
                isFolder={true}
                isSelected={selected.has(prefix)}
                currentPrefix={currentPrefix}
                onSelect={handleSelect}
                onNavigate={onNavigate}
                onDownload={onDownload}
                onRename={onRename}
              />
            ))}
            {items.objects.map(obj => (
              <FileRow
                key={obj.key}
                name={objectName(obj.key)}
                objectKey={obj.key}
                size={obj.size}
                lastModified={obj.lastModified}
                isFolder={false}
                isSelected={selected.has(obj.key)}
                currentPrefix={currentPrefix}
                onSelect={handleSelect}
                onNavigate={onNavigate}
                onDownload={onDownload}
                onRename={onRename}
              />
            ))}
            {!loading && totalItems === 0 && (
              <tr>
                <td colSpan={5} style={styles.empty}>This folder is empty</td>
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
    padding: '0 16px',
    background: '#fafafa',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #e0e0e0',
  },
  disconnectBtn: {
    padding: '5px 12px',
    background: '#fff',
    border: '1px solid #d0d0d0',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
    color: '#666',
  },
  tableWrap: {
    flex: 1,
    overflow: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    textAlign: 'left',
    padding: '10px 12px',
    fontSize: 12,
    fontWeight: 600,
    color: '#666',
    borderBottom: '2px solid #e0e0e0',
    background: '#fafafa',
    position: 'sticky',
    top: 0,
  },
  nameCol: {
    width: '50%',
  },
  error: {
    color: '#d93025',
    fontSize: 13,
    padding: '8px 10px',
    background: '#fce8e6',
    borderRadius: 4,
    margin: '8px 0',
  },
  spinner: {
    padding: '12px 0',
    fontSize: 13,
    color: '#888',
  },
  empty: {
    padding: 24,
    textAlign: 'center',
    color: '#999',
    fontSize: 14,
  },
  confirmBar: {
    padding: '8px 12px',
    background: '#fff3cd',
    borderRadius: 4,
    margin: '8px 0',
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  cancelBtn: {
    padding: '4px 10px',
    border: '1px solid #d0d0d0',
    borderRadius: 3,
    fontSize: 12,
    background: '#fff',
    cursor: 'pointer',
  },
};
