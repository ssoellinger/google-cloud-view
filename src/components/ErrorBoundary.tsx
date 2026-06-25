import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Catches render errors so a crash shows a recoverable message instead of a blank screen. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error('Unhandled UI error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.icon}>&#9888;</div>
            <h2 style={styles.title}>Something went wrong</h2>
            <p style={styles.message}>{this.state.error.message || 'An unexpected error occurred.'}</p>
            <button style={styles.btn} onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f5f6fa 0%, #e8eaf6 100%)',
    padding: 24,
  },
  card: {
    background: '#fff',
    borderRadius: 16,
    padding: '32px 40px',
    textAlign: 'center',
    boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
    maxWidth: 460,
  },
  icon: {
    fontSize: 40,
    marginBottom: 8,
  },
  title: {
    margin: '0 0 8px',
    fontSize: 20,
    fontWeight: 700,
    color: '#2d3436',
  },
  message: {
    margin: '0 0 20px',
    fontSize: 13,
    color: '#636e72',
    wordBreak: 'break-word',
  },
  btn: {
    padding: '10px 24px',
    background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
