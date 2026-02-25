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
        <span key={crumb.path} style={styles.crumbWrap}>
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
    padding: '10px 0',
    flexWrap: 'wrap',
  },
  crumbWrap: {
    display: 'inline-flex',
    alignItems: 'center',
  },
  link: {
    background: 'none',
    border: 'none',
    color: '#6c5ce7',
    cursor: 'pointer',
    padding: '3px 6px',
    fontSize: 14,
    borderRadius: 4,
    fontWeight: 500,
    transition: 'background 0.15s',
  },
  current: {
    color: '#2d3436',
    fontWeight: 600,
    padding: '3px 6px',
    background: '#f0edff',
    borderRadius: 4,
  },
  sep: {
    color: '#b2bec3',
    margin: '0 1px',
    fontSize: 13,
  },
};
