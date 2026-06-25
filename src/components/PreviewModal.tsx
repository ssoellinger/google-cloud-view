import { useEffect, useState } from 'react';
import { formatSize, getErrorMessage } from '../utils/format';

interface Props {
  objectKey: string;
  name: string;
  size: number;
  onClose: () => void;
  onDownload: () => void;
}

type Category = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'unsupported';

const MAX_PREVIEW_BYTES = 50 * 1024 * 1024; // 50 MB

const EXT: Record<string, { category: Category; mime: string }> = {
  // images
  png: { category: 'image', mime: 'image/png' },
  jpg: { category: 'image', mime: 'image/jpeg' },
  jpeg: { category: 'image', mime: 'image/jpeg' },
  gif: { category: 'image', mime: 'image/gif' },
  webp: { category: 'image', mime: 'image/webp' },
  bmp: { category: 'image', mime: 'image/bmp' },
  ico: { category: 'image', mime: 'image/x-icon' },
  svg: { category: 'image', mime: 'image/svg+xml' },
  // video
  mp4: { category: 'video', mime: 'video/mp4' },
  webm: { category: 'video', mime: 'video/webm' },
  m4v: { category: 'video', mime: 'video/mp4' },
  ogv: { category: 'video', mime: 'video/ogg' },
  // audio
  mp3: { category: 'audio', mime: 'audio/mpeg' },
  wav: { category: 'audio', mime: 'audio/wav' },
  m4a: { category: 'audio', mime: 'audio/mp4' },
  aac: { category: 'audio', mime: 'audio/aac' },
  flac: { category: 'audio', mime: 'audio/flac' },
  oga: { category: 'audio', mime: 'audio/ogg' },
  // pdf
  pdf: { category: 'pdf', mime: 'application/pdf' },
};

const TEXT_EXT = new Set([
  'txt', 'md', 'markdown', 'json', 'xml', 'csv', 'tsv', 'log', 'yml', 'yaml',
  'ini', 'toml', 'env', 'conf', 'cfg', 'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs',
  'html', 'htm', 'css', 'scss', 'less', 'sh', 'bash', 'py', 'rb', 'go', 'rs',
  'java', 'c', 'h', 'cpp', 'hpp', 'cs', 'php', 'sql', 'gitignore', 'dockerfile',
]);

function classify(name: string): { category: Category; mime: string } {
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  if (EXT[ext]) return EXT[ext];
  if (TEXT_EXT.has(ext)) return { category: 'text', mime: 'text/plain' };
  return { category: 'unsupported', mime: 'application/octet-stream' };
}

type State =
  | { status: 'loading' }
  | { status: 'ready-url'; url: string }
  | { status: 'ready-text'; text: string }
  | { status: 'too-large' }
  | { status: 'unsupported' }
  | { status: 'error'; error: string };

export function PreviewModal({ objectKey, name, size, onClose, onDownload }: Props) {
  const { category, mime } = classify(name);
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    if (category === 'unsupported') {
      setState({ status: 'unsupported' });
      return;
    }
    if (size > MAX_PREVIEW_BYTES) {
      setState({ status: 'too-large' });
      return;
    }

    setState({ status: 'loading' });
    (async () => {
      try {
        const data = await window.gcsApi.previewFile(objectKey);
        if (cancelled) return;
        const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
        if (category === 'text') {
          setState({ status: 'ready-text', text: new TextDecoder().decode(bytes) });
        } else {
          // Copy into a fresh ArrayBuffer so the Blob part is concretely ArrayBuffer-backed
          const ab = new ArrayBuffer(bytes.byteLength);
          new Uint8Array(ab).set(bytes);
          const blob = new Blob([ab], { type: mime });
          objectUrl = URL.createObjectURL(blob);
          setState({ status: 'ready-url', url: objectUrl });
        }
      } catch (e) {
        if (!cancelled) setState({ status: 'error', error: getErrorMessage(e) });
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectKey, name, size, category, mime]);

  const renderBody = () => {
    switch (state.status) {
      case 'loading':
        return <div style={styles.message}>Loading preview…</div>;
      case 'error':
        return <div style={{ ...styles.message, color: '#d63031' }}>Could not load preview: {state.error}</div>;
      case 'too-large':
        return (
          <div style={styles.message}>
            This file is {formatSize(size)} — too large to preview.
            <div><button style={styles.fallbackBtn} onClick={onDownload}>Download instead</button></div>
          </div>
        );
      case 'unsupported':
        return (
          <div style={styles.message}>
            No preview available for this file type.
            <div><button style={styles.fallbackBtn} onClick={onDownload}>Download instead</button></div>
          </div>
        );
      case 'ready-text':
        return <pre style={styles.text}>{state.text}</pre>;
      case 'ready-url':
        if (category === 'image') return <img src={state.url} alt={name} style={styles.image} />;
        if (category === 'video') return <video src={state.url} controls autoPlay style={styles.media} />;
        if (category === 'audio') return <audio src={state.url} controls autoPlay style={styles.audio} />;
        if (category === 'pdf') return <iframe src={state.url} title={name} style={styles.iframe} />;
        return null;
    }
  };

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.fileName} title={name}>{name}</span>
          <span style={styles.meta}>{formatSize(size)}</span>
          <span style={styles.spacer} />
          <button style={styles.headerBtn} onClick={onDownload} title="Download">&#8595; Download</button>
          <button style={styles.closeBtn} onClick={onClose} title="Close (Esc)">&times;</button>
        </div>
        <div style={styles.body}>{renderBody()}</div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(20, 22, 28, 0.72)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 24,
  },
  modal: {
    background: '#fff',
    borderRadius: 14,
    width: '86vw',
    height: '88vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 16px 56px rgba(0,0,0,0.4)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    borderBottom: '1px solid #eef0f4',
    flexShrink: 0,
  },
  fileName: {
    fontSize: 14,
    fontWeight: 600,
    color: '#2d3436',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '50%',
  },
  meta: {
    fontSize: 12,
    color: '#b2bec3',
    fontVariantNumeric: 'tabular-nums',
  },
  spacer: { flex: 1 },
  headerBtn: {
    padding: '6px 14px',
    background: '#fff',
    border: '1.5px solid #e0e4ea',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 500,
    color: '#636e72',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 24,
    lineHeight: 1,
    color: '#b2bec3',
    cursor: 'pointer',
    padding: '0 4px',
  },
  body: {
    flex: 1,
    overflow: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f5f6fa',
  },
  message: {
    color: '#636e72',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 2,
  },
  fallbackBtn: {
    marginTop: 8,
    padding: '8px 18px',
    background: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
  },
  image: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  },
  media: {
    maxWidth: '100%',
    maxHeight: '100%',
  },
  audio: {
    width: '80%',
  },
  iframe: {
    width: '100%',
    height: '100%',
    border: 'none',
    background: '#fff',
  },
  text: {
    margin: 0,
    padding: 20,
    width: '100%',
    height: '100%',
    overflow: 'auto',
    fontFamily: "'Cascadia Code', 'Consolas', 'Courier New', monospace",
    fontSize: 13,
    lineHeight: 1.5,
    color: '#2d3436',
    background: '#fff',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    boxSizing: 'border-box',
  },
};
