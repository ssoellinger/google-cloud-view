import { useState } from 'react';

interface Props {
  onUpload: () => void;
  onRefresh: () => void;
  onDelete: () => void;
  onCreateFolder: (name: string) => void;
  hasSelection: boolean;
  loading: boolean;
}

export function Toolbar({ onUpload, onRefresh, onDelete, onCreateFolder, hasSelection, loading }: Props) {
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [folderName, setFolderName] = useState('');

  const handleCreateFolder = () => {
    if (folderName.trim()) {
      onCreateFolder(folderName.trim());
      setFolderName('');
      setShowFolderInput(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.left}>
        <button style={styles.btn} onClick={onUpload} disabled={loading} title="Upload files">
          Upload
        </button>
        <button style={styles.btn} onClick={onRefresh} disabled={loading} title="Refresh">
          Refresh
        </button>
        {!showFolderInput ? (
          <button style={styles.btn} onClick={() => setShowFolderInput(true)} disabled={loading}>
            New Folder
          </button>
        ) : (
          <span style={styles.folderInput}>
            <input
              style={styles.input}
              type="text"
              placeholder="Folder name"
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
              autoFocus
            />
            <button style={styles.btnSmall} onClick={handleCreateFolder}>Create</button>
            <button style={styles.btnSmall} onClick={() => { setShowFolderInput(false); setFolderName(''); }}>Cancel</button>
          </span>
        )}
      </div>
      <div style={styles.right}>
        {hasSelection && (
          <button style={{ ...styles.btn, ...styles.dangerBtn }} onClick={onDelete} disabled={loading}>
            Delete Selected
          </button>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #e0e0e0',
  },
  left: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  right: {
    display: 'flex',
    gap: 8,
  },
  btn: {
    padding: '6px 14px',
    background: '#fff',
    border: '1px solid #d0d0d0',
    borderRadius: 4,
    fontSize: 13,
    cursor: 'pointer',
    fontWeight: 500,
  },
  dangerBtn: {
    color: '#d93025',
    borderColor: '#d93025',
  },
  folderInput: {
    display: 'flex',
    gap: 4,
    alignItems: 'center',
  },
  input: {
    padding: '5px 8px',
    border: '1px solid #d0d0d0',
    borderRadius: 4,
    fontSize: 13,
    width: 160,
  },
  btnSmall: {
    padding: '5px 10px',
    background: '#fff',
    border: '1px solid #d0d0d0',
    borderRadius: 4,
    fontSize: 12,
    cursor: 'pointer',
  },
};
