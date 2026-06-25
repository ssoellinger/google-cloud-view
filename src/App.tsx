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
    // Encrypt the secret with the OS keychain before it ever touches localStorage
    encryptAndSave();

    async function encryptAndSave() {
      const secret = await window.gcsApi.encryptSecret(fields.secret);
      const stored = { ...fields, secret, lastUsed: new Date().toISOString() };
      if (id) {
        updateConnection(id, stored);
      } else {
        addConnection(stored);
      }
    }
  };

  const handleDirectConnect = async (conn: SavedConnection) => {
    const secret = await window.gcsApi.decryptSecret(conn.secret);
    const success = await gcs.connect({
      serviceUrl: conn.serviceUrl,
      bucketName: conn.bucketName,
      accessId: conn.accessId,
      secret,
      basePath: conn.basePath,
      timeout: conn.timeout,
    });
    if (success) {
      touchConnection(conn.id);
    }
  };

  const handleEditConnection = async (conn: SavedConnection) => {
    // Decrypt so the form can prefill the secret; it is re-encrypted on save
    const secret = await window.gcsApi.decryptSecret(conn.secret);
    setEditingConnection({ ...conn, secret });
    setScreen('connect');
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
        onEdit={handleEditConnection}
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
      onDownloadSelected={gcs.downloadSelected}
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
