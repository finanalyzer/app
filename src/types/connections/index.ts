export type ConnectionAuthType = 'none' | 'custom' | 'passxyz-jwt';

export interface Connection {
  id: string;
  name: string;
  url: string;
  apiKey: string;
  apiSecret?: string;
  description?: string;
  validateWidgets: boolean;
  authType: ConnectionAuthType;
  authentication: Array<{
    key: string;
    value: string;
    description?: string;
    location: 'header' | 'query';
  }>;
  status: 'connected' | 'disconnected' | 'testing' | 'error';
  metrics: {
    apps: number;
    widgets: number;
    prompts: number;
    agents: number;
  };
  lastActivity: string;
  createdAt: string;
  updatedAt: string;
}
