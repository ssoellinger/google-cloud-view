import { useState, useEffect } from 'react';
import { useGcs } from './hooks/useGcs';
import { useConnections, type SavedConnection } from './hooks/useConnections';
import { SavedConnections } from './components/SavedConnections';
import { ConnectionForm } from './components/ConnectionForm';
import { FileBrowser } from './components/FileBrowser';

type Screen = 'connections' | 'connect' | 'browser';

export function App() {
  const gcs = useGcs();
  const { connections, addConnection, updateConnection, removeConnection, touchConnection } = useConnections();

  const [screen, setScreen] = useState<Screen>('connections');
  const [editingConnection, setEditingConnection] = useState<SavedConnection | null>(null);

  // Transition to browser screen after successful connection
  useEffect(() => {
    if (gcs.connected && screen !== 'browser') {
      setScreen('browser');
    }
  }, [gcs.connected, screen]);

  const handleSaveConnection = (data: {
    id?: string;
    name: string;
    serviceUrl: string;
    bucketName: string;
    accessId: string;
    secret: string;
    basePath: string;
    timeout: number;
  }) => {
    const { id, ...fields } = data;
    if (id) {
      updateConnection(id, { ...fields, lastUsed: new Date().toISOString() });
    } else {
      addConnection({ ...fields, lastUsed: new Date().toISOString() });
    }
  };

  const handleDirectConnect = async (conn: SavedConnection) => {
    const success = await gcs.connect({
      serviceUrl: conn.serviceUrl,
      bucketName: conn.bucketName,
      accessId: conn.accessId,
      secret: conn.secret,
      basePath: conn.basePath,
      timeout: conn.timeout,
    });
    if (success) {
      touchConnection(conn.id);
    }
  };

  const handleDisconnect = () => {
    setEditingConnection(null);
    setScreen('connections');
    window.location.reload();
  };

  if (screen === 'connections') {
    return (
      <SavedConnections
        connections={connections}
        onConnect={handleDirectConnect}
        onEdit={(conn) => {
          setEditingConnection(conn);
          setScreen('connect');
        }}
        onDelete={removeConnection}
        onNewConnection={() => {
          setEditingConnection(null);
          setScreen('connect');
        }}
        loading={gcs.loading}
        error={gcs.error}
      />
    );
  }

  if (screen === 'connect') {
    return (
      <ConnectionForm
        onConnect={gcs.connect}
        loading={gcs.loading}
        error={gcs.error}
        onBack={() => { setEditingConnection(null); setScreen('connections'); }}
        initialValues={editingConnection ?? undefined}
        initialName={editingConnection?.name}
        savedConnectionId={editingConnection?.id}
        onSaveConnection={handleSaveConnection}
      />
    );
  }

  return (
    <FileBrowser
      treeData={gcs.treeData}
      expandedPaths={gcs.expandedPaths}
      currentPrefix={gcs.currentPrefix}
      loading={gcs.loading}
      error={gcs.error}
      onNavigate={gcs.navigateTo}
      onUpload={gcs.uploadFiles}
      onRefresh={() => gcs.refreshList()}
      onDownload={gcs.downloadFile}
      onDelete={gcs.deleteFiles}
      onMove={gcs.moveFile}
      onCopy={gcs.copyFile}
      onDuplicate={gcs.duplicateFile}
      onCreateFolder={gcs.createFolder}
      onCreateSubfolder={gcs.createSubfolder}
      onUploadFromPaths={gcs.uploadFromPaths}
      onDisconnect={handleDisconnect}
      onToggleFolder={gcs.toggleFolder}
      onExpandAll={gcs.expandAll}
      onCollapseAll={gcs.collapseAll}
    />
  );
}
