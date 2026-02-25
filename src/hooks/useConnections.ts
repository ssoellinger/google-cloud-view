import { useState, useCallback, useEffect } from 'react';

export interface SavedConnection {
  id: string;
  name: string;
  serviceUrl: string;
  bucketName: string;
  accessId: string;
  secret: string;
  basePath: string;
  timeout: number;
  lastUsed?: string;
}

const STORAGE_KEY = 'gcs-saved-connections';

function loadConnections(): SavedConnection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConnections(connections: SavedConnection[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(connections));
}

export function useConnections() {
  const [connections, setConnections] = useState<SavedConnection[]>(() => loadConnections());

  useEffect(() => {
    saveConnections(connections);
  }, [connections]);

  const addConnection = useCallback((conn: Omit<SavedConnection, 'id'>) => {
    const newConn: SavedConnection = { ...conn, id: crypto.randomUUID() };
    setConnections(prev => [...prev, newConn]);
    return newConn.id;
  }, []);

  const updateConnection = useCallback((id: string, updates: Partial<Omit<SavedConnection, 'id'>>) => {
    setConnections(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const removeConnection = useCallback((id: string) => {
    setConnections(prev => prev.filter(c => c.id !== id));
  }, []);

  const touchConnection = useCallback((id: string) => {
    setConnections(prev => prev.map(c =>
      c.id === id ? { ...c, lastUsed: new Date().toISOString() } : c
    ));
  }, []);

  return { connections, addConnection, updateConnection, removeConnection, touchConnection };
}
