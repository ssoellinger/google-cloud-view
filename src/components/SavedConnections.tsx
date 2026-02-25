import { formatDate } from '../utils/format';
import type { SavedConnection } from '../hooks/useConnections';

interface Props {
  connections: SavedConnection[];
  onConnect: (connection: SavedConnection) => void;
  onEdit: (connection: SavedConnection) => void;
  onDelete: (id: string) => void;
  onNewConnection: () => void;
  loading?: boolean;
  error?: string | null;
}

export function SavedConnections({ connections, onConnect, onEdit, onDelete, onNewConnection, loading, error }: Props) {
  const sorted = [...connections].sort((a, b) => {
    if (!a.lastUsed && !b.lastUsed) return 0;
    if (!a.lastUsed) return 1;
    if (!b.lastUsed) return -1;
    return b.lastUsed.localeCompare(a.lastUsed);
  });

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Google Cloud View <span style={styles.version}>v0.0.1</span></h2>
            <p style={styles.subtitle}>Select a saved connection or create a new one</p>
          </div>
          <button style={styles.primaryBtn} onClick={onNewConnection}>+ New Connection</button>
        </div>
        {loading && <div style={styles.loadingBar}>Connecting...</div>}
        {error && <div style={styles.errorBar}>{error}</div>}
        {sorted.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>&#9729;</div>
            <p style={styles.emptyTitle}>No connections yet</p>
            <p style={styles.emptyText}>Create your first connection to get started</p>
            <button style={styles.primaryBtn} onClick={onNewConnection}>+ New Connection</button>
          </div>
        ) : (
          <div style={styles.list}>
            {sorted.map(conn => (
              <div key={conn.id} style={styles.connCard}>
                <div style={styles.connInfo}>
                  <div style={styles.connName}>{conn.name}</div>
                  <div style={styles.connMeta}>
                    <span style={styles.badge}>{conn.bucketName}</span>
                    <span style={styles.connUrl}>{conn.serviceUrl}</span>
                  </div>
                  {conn.lastUsed && <div style={styles.connDate}>Last used {formatDate(conn.lastUsed)}</div>}
                </div>
                <div style={styles.connActions}>
                  <button style={styles.primaryBtnSm} onClick={() => onConnect(conn)} disabled={loading}>Connect</button>
                  <button style={styles.ghostBtn} onClick={() => onEdit(conn)}>Edit</button>
                  <button style={styles.dangerGhostBtn} onClick={() => onDelete(conn.id)}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f5f6fa 0%, #e8eaf6 100%)',
    padding: '48px 16px',
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '32px 36px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
    width: 680,
    maxWidth: '95vw',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: '#2d3436',
    letterSpacing: '-0.3px',
  },
  subtitle: {
    margin: '4px 0 0',
    fontSize: 13,
    color: '#888',
    fontWeight: 400,
  },
  version: {
    fontSize: 12,
    fontWeight: 400,
    color: '#b2bec3',
  },
  primaryBtn: {
    padding: '9px 20px',
    background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: '0.2px',
    boxShadow: '0 2px 8px rgba(108,92,231,0.25)',
  },
  empty: {
    textAlign: 'center',
    padding: '48px 0 32px',
  },
  emptyIcon: {
    fontSize: 48,
    color: '#dfe6e9',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#636e72',
    marginBottom: 4,
  },
  emptyText: {
    color: '#b2bec3',
    fontSize: 13,
    marginBottom: 20,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  connCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 18px',
    background: '#fafbfc',
    borderRadius: 10,
    border: '1px solid #eef0f4',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  connInfo: {
    flex: 1,
    minWidth: 0,
  },
  connName: {
    fontSize: 14,
    fontWeight: 600,
    color: '#2d3436',
    marginBottom: 4,
  },
  connMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  badge: {
    display: 'inline-block',
    padding: '2px 8px',
    background: '#e8eaf6',
    color: '#6c5ce7',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.3px',
  },
  connUrl: {
    fontSize: 12,
    color: '#b2bec3',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  connDate: {
    fontSize: 11,
    color: '#b2bec3',
    marginTop: 2,
  },
  connActions: {
    display: 'flex',
    gap: 6,
    marginLeft: 16,
    flexShrink: 0,
  },
  primaryBtnSm: {
    padding: '6px 16px',
    background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    boxShadow: '0 1px 4px rgba(108,92,231,0.2)',
  },
  ghostBtn: {
    padding: '6px 12px',
    background: 'transparent',
    border: '1px solid #dfe6e9',
    borderRadius: 6,
    fontSize: 12,
    color: '#636e72',
    fontWeight: 500,
  },
  dangerGhostBtn: {
    padding: '6px 12px',
    background: 'transparent',
    border: '1px solid #fab1a0',
    borderRadius: 6,
    fontSize: 12,
    color: '#d63031',
    fontWeight: 500,
  },
  loadingBar: {
    padding: '10px 16px',
    background: 'linear-gradient(135deg, #e8eaf6, #f0edff)',
    borderRadius: 8,
    fontSize: 13,
    color: '#6c5ce7',
    fontWeight: 500,
    marginBottom: 16,
  },
  errorBar: {
    padding: '10px 16px',
    background: '#fff5f5',
    borderRadius: 8,
    fontSize: 13,
    color: '#d63031',
    fontWeight: 500,
    marginBottom: 16,
    border: '1px solid #fab1a0',
  },
};
