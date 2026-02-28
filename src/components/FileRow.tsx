import { useState, useRef, useEffect } from 'react';
import { formatSize, formatDate } from '../utils/format';

interface Props {
  name: string;
  objectKey: string;
  size: number;
  lastModified: string;
  isFolder: boolean;
  isSelected: boolean;
  currentPrefix: string;
  depth: number;
  isExpanded?: boolean;
  hasChildren?: boolean;
  onToggleExpand?: () => void;
  onSelect: (key: string, checked: boolean) => void;
  onDownload: (key: string) => void;
  onMove: (sourceKey: string, destKey: string) => void;
  onCopyToFolder?: (sourceKey: string, destKey: string) => void;
  onDuplicate?: (key: string) => void;
  onCreateSubfolder?: (parentPrefix: string, folderName: string) => void;
  onUploadToFolder?: (paths: string[], targetPrefix: string) => void;
  onDismissDropZone?: () => void;
}

export function FileRow({
  name, objectKey, size, lastModified, isFolder,
  isSelected, currentPrefix, depth, isExpanded, hasChildren, onToggleExpand,
  onSelect, onDownload, onMove, onCopyToFolder, onDuplicate, onCreateSubfolder, onUploadToFolder, onDismissDropZone,
}: Props) {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(name);
  const [dragOver, setDragOver] = useState(false);
  const [showSubfolderInput, setShowSubfolderInput] = useState(false);
  const [subfolderName, setSubfolderName] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleRename = () => {
    if (newName.trim() && newName !== name) {
      const newKey = currentPrefix + newName + (isFolder ? '/' : '');
      onMove(objectKey, newKey);
    }
    setRenaming(false);
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', objectKey);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isFolder) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
    setDragOver(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    setDragOver(false);
    if (!isFolder) return;
    e.preventDefault();
    e.stopPropagation();

    // External file drop from desktop
    if (e.dataTransfer.types.includes('Files') && e.dataTransfer.files.length > 0) {
      onDismissDropZone?.();
      if (onUploadToFolder) {
        const paths: string[] = [];
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
          const p = window.gcsApi.getPathForFile(e.dataTransfer.files[i]);
          if (p) paths.push(p);
        }
        if (paths.length > 0) onUploadToFolder(paths, objectKey);
      }
      return;
    }

    // Internal drag
    const sourceKey = e.dataTransfer.getData('text/plain');
    if (!sourceKey || sourceKey === objectKey) return;
    if (objectKey.startsWith(sourceKey)) return;
    const fileName = sourceKey.replace(/\/$/, '').split('/').pop()!;
    const isSourceFolder = sourceKey.endsWith('/');
    const destKey = objectKey + fileName + (isSourceFolder ? '/' : '');
    if (sourceKey === destKey) return;
    if (e.ctrlKey && onCopyToFolder) {
      onCopyToFolder(sourceKey, destKey);
    } else {
      onMove(sourceKey, destKey);
    }
  };

  const handleCreateSubfolder = () => {
    if (subfolderName.trim() && onCreateSubfolder) {
      onCreateSubfolder(objectKey, subfolderName.trim());
      setSubfolderName('');
      setShowSubfolderInput(false);
    }
  };

  const indent = depth * 22;
  const rowBg = dragOver ? '#f0edff' : isSelected ? '#f5f3ff' : undefined;

  return (
    <>
      <tr
        style={{ ...styles.row, background: rowBg }}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <td style={styles.cell}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={e => onSelect(objectKey, e.target.checked)}
            style={{ accentColor: '#6c5ce7' }}
          />
        </td>
        <td style={styles.nameCell}>
          <span style={{ paddingLeft: indent, display: 'flex', alignItems: 'center', gap: 6 }}>
            {isFolder && hasChildren !== false ? (
              <button
                style={styles.chevron}
                onClick={e => { e.stopPropagation(); onToggleExpand?.(); }}
                title={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? '\u25BE' : '\u25B8'}
              </button>
            ) : (
              <span style={{ width: 16, display: 'inline-block' }} />
            )}
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
              <button style={styles.link} onClick={() => onToggleExpand?.()}>
                {name}
              </button>
            ) : (
              <span style={styles.fileName}>{name}</span>
            )}
          </span>
        </td>
        <td style={styles.metaCell}>{formatSize(size)}</td>
        <td style={styles.metaCell}>{formatDate(lastModified)}</td>
        <td style={styles.actionsCell}>
          <div ref={menuRef} style={styles.menuWrapper}>
            <button style={styles.menuBtn} onClick={() => setMenuOpen(v => !v)} title="Actions">
              &#8943;
            </button>
            {menuOpen && (
              <div style={styles.menu}>
                <button style={styles.menuItem} onClick={() => { setMenuOpen(false); onDownload(objectKey); }}>
                  <span style={styles.menuIcon}>&#8595;</span> {isFolder ? 'Download as ZIP' : 'Download'}
                </button>
                <button style={styles.menuItem} onClick={() => { setMenuOpen(false); setRenaming(true); setNewName(name); }}>
                  <span style={styles.menuIcon}>&#9998;</span> Rename
                </button>
                {onDuplicate && (
                  <button style={styles.menuItem} onClick={() => { setMenuOpen(false); onDuplicate(objectKey); }}>
                    <span style={styles.menuIcon}>&#10697;</span> Duplicate
                  </button>
                )}
                {isFolder && onCreateSubfolder && (
                  <button style={styles.menuItem} onClick={() => { setMenuOpen(false); setShowSubfolderInput(v => !v); }}>
                    <span style={styles.menuIcon}>&#128193;</span> Add new subfolder
                  </button>
                )}
              </div>
            )}
          </div>
        </td>
      </tr>
      {showSubfolderInput && (
        <tr style={styles.subfolderRow}>
          <td style={styles.cell} />
          <td style={styles.nameCell} colSpan={4}>
            <span style={{ paddingLeft: indent + 22, display: 'flex', alignItems: 'center', gap: 6 }}>
              <input
                style={styles.input}
                type="text"
                placeholder="Subfolder name"
                value={subfolderName}
                onChange={e => setSubfolderName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleCreateSubfolder();
                  if (e.key === 'Escape') { setShowSubfolderInput(false); setSubfolderName(''); }
                }}
                autoFocus
              />
              <button style={styles.btnTiny} onClick={handleCreateSubfolder}>Create</button>
              <button style={{ ...styles.btnTiny, color: '#b2bec3' }} onClick={() => { setShowSubfolderInput(false); setSubfolderName(''); }}>Cancel</button>
            </span>
          </td>
        </tr>
      )}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    borderBottom: '1px solid #f0f1f5',
    transition: 'background 0.12s',
  },
  subfolderRow: {
    borderBottom: '1px solid #f0f1f5',
    background: '#fafbfc',
  },
  cell: {
    padding: '9px 14px',
    fontSize: 13,
    color: '#2d3436',
    whiteSpace: 'nowrap',
  },
  nameCell: {
    padding: '9px 14px',
    fontSize: 13,
    color: '#2d3436',
  },
  metaCell: {
    padding: '9px 14px',
    fontSize: 12,
    color: '#b2bec3',
    whiteSpace: 'nowrap',
    fontVariantNumeric: 'tabular-nums',
  },
  actionsCell: {
    padding: '9px 14px',
    whiteSpace: 'nowrap',
  },
  chevron: {
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontSize: 13,
    color: '#b2bec3',
    width: 16,
    textAlign: 'center',
    lineHeight: 1,
    flexShrink: 0,
    transition: 'color 0.12s',
  },
  folderIcon: {
    fontSize: 17,
    flexShrink: 0,
  },
  fileIcon: {
    fontSize: 17,
    flexShrink: 0,
    opacity: 0.7,
  },
  link: {
    background: 'none',
    border: 'none',
    color: '#6c5ce7',
    cursor: 'pointer',
    padding: 0,
    fontSize: 13,
    fontWeight: 600,
  },
  fileName: {
    color: '#2d3436',
    fontWeight: 400,
  },
  menuWrapper: {
    position: 'relative',
    display: 'inline-block',
  },
  menuBtn: {
    background: 'none',
    border: 'none',
    fontSize: 18,
    cursor: 'pointer',
    color: '#636e72',
    padding: '2px 6px',
    borderRadius: 4,
    lineHeight: 1,
    transition: 'background 0.12s',
  },
  menu: {
    position: 'absolute',
    right: 0,
    top: '100%',
    background: '#fff',
    border: '1px solid #e0e4ea',
    borderRadius: 8,
    boxShadow: '0 4px 16px rgba(0,0,0,0.10)',
    zIndex: 100,
    minWidth: 150,
    padding: '4px 0',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    background: 'none',
    border: 'none',
    padding: '7px 14px',
    fontSize: 13,
    color: '#2d3436',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    textAlign: 'left',
  },
  menuIcon: {
    width: 18,
    textAlign: 'center',
    fontSize: 14,
    flexShrink: 0,
  },
  renameInput: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  input: {
    padding: '5px 8px',
    border: '1.5px solid #e0e4ea',
    borderRadius: 6,
    fontSize: 13,
    width: 200,
    color: '#2d3436',
    background: '#fff',
  },
  btnTiny: {
    padding: '4px 10px',
    border: '1.5px solid #e0e4ea',
    borderRadius: 6,
    fontSize: 12,
    cursor: 'pointer',
    background: '#fff',
    color: '#636e72',
    fontWeight: 500,
  },
};
