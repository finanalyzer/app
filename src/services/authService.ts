import { connectionService } from './connections/connectionService';
import type { Connection, ConnectionAuthType } from '../types/connections';

function normalizeUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

export function getPassxyzToken(): string | null {
  return localStorage.getItem('passxyz-token');
}

export function findConnectionByUrl(url: string): Connection | undefined {
  const normalizedUrl = normalizeUrl(url);
  const connections = connectionService.getConnections();
  return connections.find(
    (conn) => normalizeUrl(conn.url) === normalizedUrl
  );
}

export function getConnectionAuthType(url: string): ConnectionAuthType {
  const connection = findConnectionByUrl(url);
  if (connection) {
    return connection.authType;
  }
  
  if (url.startsWith('/') && getPassxyzToken()) {
    return 'passxyz-jwt';
  }
  
  return 'none';
}

export function getAuthHeaders(url: string): HeadersInit {
  const headers: HeadersInit = {};
  const connection = findConnectionByUrl(url);
  
  if (connection) {
    switch (connection.authType) {
      case 'passxyz-jwt':
        const token = getPassxyzToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        break;
        
      case 'custom':
        connection.authentication.forEach((auth: { key: string; value: string; location: 'header' | 'query' }) => {
          if (auth.location === 'header') {
            headers[auth.key] = auth.value;
          }
        });
        break;
    }
  } else if (url.startsWith('/') && getPassxyzToken()) {
    headers['Authorization'] = `Bearer ${getPassxyzToken()!}`;
  }
  
  return headers;
}

export function getAuthQueryParams(url: string): URLSearchParams {
  const params = new URLSearchParams();
  const connection = findConnectionByUrl(url);
  
  if (connection?.authType === 'custom') {
    connection.authentication.forEach((auth: { key: string; value: string; location: 'header' | 'query' }) => {
      if (auth.location === 'query') {
        params.append(auth.key, auth.value);
      }
    });
  }
  
  return params;
}

export function isAuthenticated(): boolean {
  const connections = connectionService.getConnections();
  
  if (connections.length === 0) {
    return !!getPassxyzToken();
  }
  
  for (const conn of connections) {
    switch (conn.authType) {
      case 'passxyz-jwt':
        if (!getPassxyzToken()) {
          return false;
        }
        break;
      case 'custom':
        if (conn.authentication.length === 0) {
          return false;
        }
        break;
    }
  }
  
  return true;
}

export function handleUnauthorized(): void {
  localStorage.removeItem('passxyz-token');
  localStorage.removeItem('passxyz-user');
  window.location.href = `${window.location.origin}/vault/#/login`;
}