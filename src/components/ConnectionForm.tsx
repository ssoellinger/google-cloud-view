import { useState, useEffect } from 'react';
import type { GcsConfig } from '../hooks/useGcs';

const STORAGE_KEY = 'gcs-connection-config';

interface Props {
  onConnect: (config: GcsConfig) => void;
  loading: boolean;
  error: string | null;
}

export function ConnectionForm({ onConnect, loading, error }: Props) {
  const [config, setConfig] = useState<GcsConfig>({
    serviceUrl: '',
    bucketName: '',
    accessId: '',
    secret: '',
    basePath: '',
    timeout: 120000,
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setConfig(c => ({ ...c, ...parsed, secret: '' }));
      }
    } catch { /* ignore */ }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Persist config (excluding secret)
    const { secret: _, ...toSave } = config;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    onConnect(config);
  };

  const update = (field: keyof GcsConfig, value: string | number) => {
    setConfig(c => ({ ...c, [field]: value }));
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Connect to Google Cloud Storage</h2>
        <form onSubmit={handleSubmit} style={styles.form}>
          <label style={styles.label}>
            Service URL
            <input
              style={styles.input}
              type="url"
              placeholder="https://storage.googleapis.com"
              value={config.serviceUrl}
              onChange={e => update('serviceUrl', e.target.value)}
              required
            />
          </label>
          <label style={styles.label}>
            Bucket Name
            <input
              style={styles.input}
              type="text"
              placeholder="my-bucket"
              value={config.bucketName}
              onChange={e => update('bucketName', e.target.value)}
              required
            />
          </label>
          <label style={styles.label}>
            Access ID
            <input
              style={styles.input}
              type="text"
              value={config.accessId}
              onChange={e => update('accessId', e.target.value)}
              required
            />
          </label>
          <label style={styles.label}>
            Secret
            <input
              style={styles.input}
              type="password"
              value={config.secret}
              onChange={e => update('secret', e.target.value)}
              required
            />
          </label>
          <label style={styles.label}>
            Base Path
            <input
              style={styles.input}
              type="text"
              placeholder="optional/base/path"
              value={config.basePath}
              onChange={e => update('basePath', e.target.value)}
            />
          </label>
          <label style={styles.label}>
            Timeout (ms)
            <input
              style={styles.input}
              type="number"
              min={1000}
              value={config.timeout}
              onChange={e => update('timeout', parseInt(e.target.value) || 120000)}
            />
          </label>
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
    background: '#f0f2f5',
  },
  card: {
    background: '#fff',
    borderRadius: 8,
    padding: 32,
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    width: 420,
  },
  title: {
    margin: '0 0 24px',
    fontSize: 20,
    fontWeight: 600,
    color: '#1a1a1a',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 13,
    fontWeight: 500,
    color: '#555',
  },
  input: {
    padding: '8px 10px',
    border: '1px solid #d0d0d0',
    borderRadius: 4,
    fontSize: 14,
    outline: 'none',
  },
  button: {
    marginTop: 8,
    padding: '10px 0',
    background: '#4285f4',
    color: '#fff',
    border: 'none',
    borderRadius: 4,
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
  },
  error: {
    color: '#d93025',
    fontSize: 13,
    padding: '8px 10px',
    background: '#fce8e6',
    borderRadius: 4,
  },
};
