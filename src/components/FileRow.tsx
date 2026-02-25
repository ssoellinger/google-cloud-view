import { useState } from 'react';

interface Props {
  name: string;
  objectKey: string;
  size: number;
  lastModified: string;
  isFolder: boolean;
  isSelected: boolean;
  currentPrefix: string;
  onSelect: (key: string, checked: boolean) => void;
  onNavigate: (prefix: string) => void;
  onDownload: (key: string) => void;
  onRename: (oldKey: string, newKey: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '-';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function formatDate(isoString: string): string {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function FileRow({
  name, objectKey, size, lastModified, isFolder,
  isSelected, currentPrefix, onSelect, onNavigate, onDownload, onRename,
}: Props) {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(name);

  const handleRename = () => {
    if (newName.trim() && newName !== name) {
      const newKey = currentPrefix + newName + (isFolder ? '/' : '');
      onRename(objectKey, newKey);
    }
    setRenaming(false);
  };

  return (
    <tr style={{ ...styles.row, background: isSelected ? '#e8f0fe' : undefined }}>
      <td style={styles.cell}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={e => onSelect(objectKey, e.target.checked)}
        />
      </td>
      <td style={styles.nameCell}>
        {isFolder ? (
          <span style={styles.folderIcon}>&#128193;</span>
        ) : (
          <span style={styles.fileIcon}>&#128196;</span>
        )}
        {renaming ? (
          <span style={styles.renameInput}>
            <input
              style={styles.input}
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setRenaming(false); }}
              autoFocus
            />
            <button style={styles.btnTiny} onClick={handleRename}>OK</button>
          </span>
        ) : isFolder ? (
          <button style={styles.link} onClick={() => onNavigate(objectKey)}>
            {name}
          </button>
        ) : (
          <span>{name}</span>
        )}
      </td>
      <td style={styles.cell}>{isFolder ? '-' : formatSize(size)}</td>
      <td style={styles.cell}>{isFolder ? '-' : formatDate(lastModified)}</td>
      <td style={styles.cell}>
        {!isFolder && (
          <button style={styles.actionBtn} onClick={() => onDownload(objectKey)} title="Download">
            Download
          </button>
        )}
        <button style={styles.actionBtn} onClick={() => { setRenaming(true); setNewName(name); }} title="Rename">
          Rename
        </button>
      </td>
    </tr>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    borderBottom: '1px solid #f0f0f0',
  },
  cell: {
    padding: '8px 12px',
    fontSize: 13,
    color: '#333',
    whiteSpace: 'nowrap',
  },
  nameCell: {
    padding: '8px 12px',
    fontSize: 13,
    color: '#333',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  folderIcon: {
    fontSize: 16,
  },
  fileIcon: {
    fontSize: 16,
  },
  link: {
    background: 'none',
    border: 'none',
    color: '#4285f4',
    cursor: 'pointer',
    padding: 0,
    fontSize: 13,
    fontWeight: 500,
  },
  actionBtn: {
    background: 'none',
    border: '1px solid #d0d0d0',
    borderRadius: 3,
    padding: '3px 8px',
    fontSize: 12,
    cursor: 'pointer',
    marginRight: 4,
    color: '#555',
  },
  renameInput: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  input: {
    padding: '3px 6px',
    border: '1px solid #d0d0d0',
    borderRadius: 3,
    fontSize: 13,
    width: 200,
  },
  btnTiny: {
    padding: '3px 8px',
    border: '1px solid #d0d0d0',
    borderRadius: 3,
    fontSize: 12,
    cursor: 'pointer',
    background: '#fff',
  },
};
