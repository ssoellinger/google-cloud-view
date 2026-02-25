import { useState } from 'react';

interface Props {
  onUpload: () => void;
  onRefresh: () => void;
  onDelete: () => void;
  onCreateFolder: (name: string) => void;
  hasSelection: boolean;
  loading: boolean;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  targetFolderName?: string;
}

export function Toolbar({ onUpload, onRefresh, onDelete, onCreateFolder, hasSelection, loading, onExpandAll, onCollapseAll, targetFolderName }: Props) {
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [folderName, setFolderName] = useState('');

  const handleCreateFolder = () => {
    if (folderName.trim()) {
      onCreateFolder(folderName.trim());
      setFolderName('');
      setShowFolderInput(false);
    }
  };

  const intoLabel = targetFolderName ? ` into ${targetFolderName}` : '';

  return (
    <div style={styles.container}>
      <div style={styles.left}>
        <button style={styles.btn} onClick={onUpload} disabled={loading} title={`Upload files${intoLabel}`}>
          <span style={styles.btnIcon}>&#8593;</span> Upload{intoLabel}
        </button>
        <button style={styles.btn} onClick={onRefresh} disabled={loading} title="Refresh">
          <span style={styles.btnIcon}>&#8635;</span> Refresh
        </button>
        {!showFolderInput ? (
          <button style={styles.btn} onClick={() => setShowFolderInput(true)} disabled={loading} title={`New folder${intoLabel}`}>
            <span style={styles.btnIcon}>+</span> New Folder{intoLabel}
          </button>
        ) : (
          <span style={styles.folderInput}>
            <input
              style={styles.input}
              type="text"
              placeholder={`Folder name${intoLabel}`}
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') { setShowFolderInput(false); setFolderName(''); }
              }}
              autoFocus
            />
            <button style={styles.btnSmall} onClick={handleCreateFolder}>Create</button>
            <button style={{ ...styles.btnSmall, color: '#b2bec3' }} onClick={() => { setShowFolderInput(false); setFolderName(''); }}>Cancel</button>
          </span>
        )}
        <span style={styles.separator} />
        <button style={styles.btnGhost} onClick={onExpandAll} disabled={loading} title="Expand all folders">
          Expand All
        </button>
        <button style={styles.btnGhost} onClick={onCollapseAll} disabled={loading} title="Collapse all folders">
          Collapse All
        </button>
      </div>
      <div style={styles.right}>
        {hasSelection && (
          <button style={styles.dangerBtn} onClick={onDelete} disabled={loading}>
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
    padding: '10px 0',
    borderBottom: '1px solid #eef0f4',
  },
  left: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
  },
  right: {
    display: 'flex',
    gap: 8,
  },
  separator: {
    width: 1,
    height: 20,
    background: '#e0e4ea',
    margin: '0 6px',
  },
  btn: {
    padding: '7px 14px',
    background: '#fff',
    border: '1.5px solid #e0e4ea',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    color: '#636e72',
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    transition: 'border-color 0.15s, background 0.15s',
  },
  btnIcon: {
    fontSize: 14,
    fontWeight: 700,
    color: '#6c5ce7',
  },
  btnGhost: {
    padding: '7px 12px',
    background: 'transparent',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    color: '#b2bec3',
    fontWeight: 500,
  },
  dangerBtn: {
    padding: '7px 14px',
    background: '#fff5f5',
    border: '1.5px solid #fab1a0',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    color: '#d63031',
  },
  folderInput: {
    display: 'flex',
    gap: 4,
    alignItems: 'center',
  },
  input: {
    padding: '7px 10px',
    border: '1.5px solid #e0e4ea',
    borderRadius: 8,
    fontSize: 13,
    width: 160,
    color: '#2d3436',
    background: '#fafbfc',
  },
  btnSmall: {
    padding: '6px 12px',
    background: '#fff',
    border: '1.5px solid #e0e4ea',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    color: '#636e72',
  },
};
