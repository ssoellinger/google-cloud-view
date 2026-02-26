interface Props {
  operation: 'upload' | 'download';
  fileName: string;
  percent: number;
}

export function ProgressBar({ operation, fileName, percent }: Props) {
  const label = operation === 'upload' ? 'Uploading' : 'Downloading';

  return (
    <div style={styles.container}>
      <div style={styles.info}>
        <span style={styles.label}>{label}</span>
        <span style={styles.fileName}>{fileName}</span>
        <span style={styles.percent}>{percent}%</span>
      </div>
      <div style={styles.track}>
        <div style={{ ...styles.bar, width: `${percent}%` }} />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '8px 0',
  },
  info: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    fontSize: 12,
  },
  label: {
    fontWeight: 600,
    color: '#6c5ce7',
  },
  fileName: {
    color: '#636e72',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  percent: {
    fontWeight: 600,
    color: '#2d3436',
    fontVariantNumeric: 'tabular-nums',
  },
  track: {
    height: 6,
    background: '#eef0f4',
    borderRadius: 3,
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    background: 'linear-gradient(90deg, #6c5ce7, #a29bfe)',
    borderRadius: 3,
    transition: 'width 0.2s ease',
  },
};
