import { useEffect } from 'react';

interface Props {
  onClose: () => void;
}

interface Item {
  icon: string;
  title: string;
  desc: string;
}

interface Section {
  heading: string;
  items: Item[];
}

const SECTIONS: Section[] = [
  {
    heading: 'Drag & drop',
    items: [
      { icon: '📄', title: 'Drag a file’s icon → download to your computer', desc: 'Grab the file icon (📄) and drag it onto your desktop or an Explorer window to download it there.' },
      { icon: '↗', title: 'Drag a row onto a folder → move it', desc: 'Drag anywhere else on a row and drop it on a folder to move the item into that folder.' },
      { icon: '⧉', title: 'Hold Ctrl while dragging → copy', desc: 'Same as a move, but keeps the original — the item is copied into the target folder instead of moved.' },
      { icon: '⬆', title: 'Drag files in from your computer → upload', desc: 'Drop files from Explorer anywhere in the window to upload them here, or drop them onto a folder to upload into it.' },
    ],
  },
  {
    heading: 'Selecting & bulk actions',
    items: [
      { icon: '☑', title: 'Check boxes to select items', desc: 'Use the checkbox in the header row to select everything currently visible.' },
      { icon: '↓', title: 'Download Selected', desc: 'With multiple items checked, downloads them together as a single ZIP. A single item downloads directly.' },
      { icon: '🗑', title: 'Delete Selected', desc: 'Removes all checked items. You’ll be asked to confirm before anything is deleted.' },
    ],
  },
  {
    heading: 'Row menu (⋯)',
    items: [
      { icon: '↓', title: 'Download', desc: 'Download a single file, or download a whole folder as a ZIP archive.' },
      { icon: '✎', title: 'Rename / Duplicate', desc: 'Rename an item in place, or make a copy of it next to the original.' },
      { icon: '📁', title: 'Add subfolder', desc: 'Create a new folder inside the selected folder.' },
    ],
  },
  {
    heading: 'Browsing',
    items: [
      { icon: '▴', title: 'Sort', desc: 'Click the Name, Size or Modified column headers to sort; click again to reverse.' },
      { icon: '🔍', title: 'Search', desc: 'Filter the items currently loaded in the tree by name.' },
      { icon: '▸', title: 'Expand / Collapse', desc: 'Toggle folders with the arrow, or use Expand All / Collapse All in the toolbar. Use the breadcrumb to jump back up.' },
    ],
  },
];

export function HelpModal({ onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>How it works</h2>
            <p style={styles.subtitle}>A quick guide to drag &amp; drop and the main actions</p>
          </div>
          <button style={styles.closeBtn} onClick={onClose} title="Close">&times;</button>
        </div>

        <div style={styles.body}>
          {SECTIONS.map(section => (
            <div key={section.heading} style={styles.section}>
              <h3 style={styles.sectionHeading}>{section.heading}</h3>
              {section.items.map(item => (
                <div key={item.title} style={styles.item}>
                  <span style={styles.itemIcon}>{item.icon}</span>
                  <div>
                    <div style={styles.itemTitle}>{item.title}</div>
                    <div style={styles.itemDesc}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={styles.footer}>
          <button style={styles.doneBtn} onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(45, 52, 54, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 20,
  },
  modal: {
    background: '#fff',
    borderRadius: 16,
    width: 640,
    maxWidth: '100%',
    maxHeight: '88vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 12px 48px rgba(0,0,0,0.22)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '24px 28px 16px',
    borderBottom: '1px solid #eef0f4',
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    color: '#2d3436',
    letterSpacing: '-0.3px',
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 13,
    color: '#888',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 26,
    lineHeight: 1,
    color: '#b2bec3',
    cursor: 'pointer',
    padding: '0 4px',
  },
  body: {
    padding: '8px 28px 4px',
    overflowY: 'auto',
  },
  section: {
    marginBottom: 22,
  },
  sectionHeading: {
    margin: '14px 0 10px',
    fontSize: 12,
    fontWeight: 700,
    color: '#6c5ce7',
    textTransform: 'uppercase',
    letterSpacing: '0.6px',
  },
  item: {
    display: 'flex',
    gap: 14,
    alignItems: 'flex-start',
    padding: '9px 0',
  },
  itemIcon: {
    fontSize: 18,
    width: 26,
    textAlign: 'center',
    flexShrink: 0,
    marginTop: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: '#2d3436',
    marginBottom: 2,
  },
  itemDesc: {
    fontSize: 13,
    color: '#636e72',
    lineHeight: 1.45,
  },
  footer: {
    padding: '14px 28px 22px',
    display: 'flex',
    justifyContent: 'flex-end',
    borderTop: '1px solid #eef0f4',
  },
  doneBtn: {
    padding: '9px 22px',
    background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    boxShadow: '0 2px 10px rgba(108,92,231,0.3)',
  },
};
