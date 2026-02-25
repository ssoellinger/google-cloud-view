interface Props {
  prefix: string;
  onNavigate: (prefix: string) => void;
}

export function Breadcrumb({ prefix, onNavigate }: Props) {
  const parts = prefix.split('/').filter(Boolean);

  const crumbs: { label: string; path: string }[] = [
    { label: 'Root', path: '' },
  ];

  let cumulative = '';
  for (const part of parts) {
    cumulative += part + '/';
    crumbs.push({ label: part, path: cumulative });
  }

  return (
    <div style={styles.container}>
      {crumbs.map((crumb, i) => (
        <span key={crumb.path}>
          {i > 0 && <span style={styles.sep}>/</span>}
          {i < crumbs.length - 1 ? (
            <button style={styles.link} onClick={() => onNavigate(crumb.path)}>
              {crumb.label}
            </button>
          ) : (
            <span style={styles.current}>{crumb.label}</span>
          )}
        </span>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    fontSize: 14,
    padding: '8px 0',
    flexWrap: 'wrap',
  },
  link: {
    background: 'none',
    border: 'none',
    color: '#4285f4',
    cursor: 'pointer',
    padding: '2px 4px',
    fontSize: 14,
    borderRadius: 3,
  },
  current: {
    color: '#1a1a1a',
    fontWeight: 600,
    padding: '2px 4px',
  },
  sep: {
    color: '#999',
    margin: '0 2px',
  },
};
