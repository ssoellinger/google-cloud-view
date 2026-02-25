import { useGcs } from './hooks/useGcs';
import { ConnectionForm } from './components/ConnectionForm';
import { FileBrowser } from './components/FileBrowser';

export function App() {
  const gcs = useGcs();

  if (!gcs.connected) {
    return (
      <ConnectionForm
        onConnect={gcs.connect}
        loading={gcs.loading}
        error={gcs.error}
      />
    );
  }

  return (
    <FileBrowser
      items={gcs.items}
      currentPrefix={gcs.currentPrefix}
      loading={gcs.loading}
      error={gcs.error}
      onNavigate={gcs.navigateTo}
      onUpload={gcs.uploadFiles}
      onRefresh={() => gcs.refreshList()}
      onDownload={gcs.downloadFile}
      onDelete={gcs.deleteFiles}
      onRename={gcs.moveFile}
      onCreateFolder={gcs.createFolder}
      onDisconnect={() => window.location.reload()}
    />
  );
}
