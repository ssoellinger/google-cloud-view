import { useState, useEffect } from 'react';
import type { GcsConfig } from '../hooks/useGcs';

interface Props {
  onConnect: (config: GcsConfig) => void;
  loading: boolean;
  error: string | null;
  onBack?: () => void;
  initialValues?: {
    serviceUrl: string;
    bucketName: string;
    accessId: string;
    secret: string;
    basePath: string;
    timeout: number;
  };
  initialName?: string;
  savedConnectionId?: string;
  onSaveConnection?: (data: {
    id?: string;
    name: string;
    serviceUrl: string;
    bucketName: string;
    accessId: string;
    secret: string;
    basePath: string;
    timeout: number;
  }) => void;
}

export function ConnectionForm({
  onConnect, loading, error, onBack,
  initialValues, initialName, savedConnectionId, onSaveConnection,
}: Props) {
  const [connectionName, setConnectionName] = useState(initialName || '');
  const [config, setConfig] = useState<GcsConfig>({
    serviceUrl: initialValues?.serviceUrl || '',
    bucketName: initialValues?.bucketName || '',
    accessId: initialValues?.accessId || '',
    secret: initialValues?.secret || '',
    basePath: initialValues?.basePath || '',
    timeout: initialValues?.timeout || 120000,
  });

  useEffect(() => {
    if (initialValues) return;
    try {
      const saved = localStorage.getItem('gcs-connection-config');
      if (saved) {
        const parsed = JSON.parse(saved);
        setConfig(c => ({ ...c, ...parsed, secret: '' }));
      }
    } catch { /* ignore */ }
  }, [initialValues]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const { secret: _, ...toSave } = config;
    localStorage.setItem('gcs-connection-config', JSON.stringify(toSave));
    if (onSaveConnection) {
      onSaveConnection({
        id: savedConnectionId,
        name: connectionName || config.bucketName,
        serviceUrl: config.serviceUrl,
        bucketName: config.bucketName,
        accessId: config.accessId,
        secret: config.secret,
        basePath: config.basePath,
        timeout: config.timeout,
      });
    }
    onConnect(config);
  };

  const update = (field: keyof GcsConfig, value: string | number) => {
    setConfig(c => ({ ...c, [field]: value }));
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {onBack && (
          <button style={styles.backBtn} onClick={onBack}>
            <span style={styles.backArrow}>&larr;</span> Back to connections
          </button>
        )}
        <h2 style={styles.title}>
          {savedConnectionId ? 'Edit Connection' : 'New Connection'}
        </h2>
        <p style={styles.subtitle}>Enter your GCS credentials to connect</p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            <span style={styles.labelText}>Connection Name</span>
            <input
              style={styles.input}
              type="text"
              placeholder="e.g. Production"
              value={connectionName}
              onChange={e => setConnectionName(e.target.value)}
            />
          </label>
          <div style={styles.row}>
            <label style={{ ...styles.label, flex: 1 }}>
              <span style={styles.labelText}>Service URL</span>
              <input
                style={styles.input}
                type="url"
                placeholder="https://storage.googleapis.com"
                value={config.serviceUrl}
                onChange={e => update('serviceUrl', e.target.value)}
                required
              />
            </label>
            <label style={{ ...styles.label, flex: 1 }}>
              <span style={styles.labelText}>Bucket Name</span>
              <input
                style={styles.input}
                type="text"
                placeholder="my-bucket"
                value={config.bucketName}
                onChange={e => update('bucketName', e.target.value)}
                required
              />
            </label>
          </div>
          <div style={styles.row}>
            <label style={{ ...styles.label, flex: 1 }}>
              <span style={styles.labelText}>Access ID</span>
              <input
                style={styles.input}
                type="text"
                value={config.accessId}
                onChange={e => update('accessId', e.target.value)}
                required
              />
            </label>
            <label style={{ ...styles.label, flex: 1 }}>
              <span style={styles.labelText}>Secret</span>
              <input
                style={styles.input}
                type="password"
                value={config.secret}
                onChange={e => update('secret', e.target.value)}
                required
              />
            </label>
          </div>
          <div style={styles.row}>
            <label style={{ ...styles.label, flex: 2 }}>
              <span style={styles.labelText}>Base Path</span>
              <input
                style={styles.input}
                type="text"
                placeholder="optional/base/path"
                value={config.basePath}
                onChange={e => update('basePath', e.target.value)}
              />
            </label>
            <label style={{ ...styles.label, flex: 1 }}>
              <span style={styles.labelText}>Timeout (ms)</span>
              <input
                style={styles.input}
                type="number"
                min={1000}
                value={config.timeout}
                onChange={e => update('timeout', parseInt(e.target.value) || 120000)}
              />
            </label>
          </div>
          {error && <div style={styles.error}>{error}</div>}
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f5f6fa 0%, #e8eaf6 100%)',
    padding: 16,
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '32px 36px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
    width: 520,
    maxWidth: '95vw',
  },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#6c5ce7',
    fontSize: 13,
    padding: '0 0 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontWeight: 500,
  },
  backArrow: {
    fontSize: 16,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
    color: '#2d3436',
    letterSpacing: '-0.3px',
  },
  subtitle: {
    margin: '4px 0 24px',
    fontSize: 13,
    color: '#888',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  row: {
    display: 'flex',
    gap: 12,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
  },
  labelText: {
    fontSize: 12,
    fontWeight: 600,
    color: '#636e72',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  input: {
    padding: '10px 12px',
    border: '1.5px solid #e0e4ea',
    borderRadius: 8,
    fontSize: 14,
    color: '#2d3436',
    background: '#fafbfc',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  },
  button: {
    marginTop: 4,
    padding: '12px 0',
    background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: '0.3px',
    boxShadow: '0 2px 12px rgba(108,92,231,0.3)',
  },
  error: {
    color: '#d63031',
    fontSize: 13,
    padding: '10px 14px',
    background: '#fff5f5',
    borderRadius: 8,
    border: '1px solid #fab1a0',
    fontWeight: 500,
  },
};
