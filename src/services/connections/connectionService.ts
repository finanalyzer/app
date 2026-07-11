import type { Connection } from "../../types/connections";
import { ConnectionStorageFactory } from "./ConnectionStorageFactory";

function normalizeBaseUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function isValidHeaderName(name: string): boolean {
  return /^[a-zA-Z0-9\-_!#$%&'*+.`|^~]+$/.test(name);
}

function getPassxyzToken(): string | null {
  return localStorage.getItem('passxyz-token');
}

function getStorage() {
  return ConnectionStorageFactory.getInstance();
}

export const connectionService = {
  getConnections(): Connection[] {
    try {
      return getStorage().getConnections();
    } catch (error) {
      console.error("Error getting connections:", error);
      return [];
    }
  },

  getConnection(id: string): Connection | undefined {
    try {
      return getStorage().getConnection(id);
    } catch (error) {
      console.error("Error getting connection:", error);
      return undefined;
    }
  },

  createConnection(
    connection: Omit<
      Connection,
      "id" | "createdAt" | "updatedAt" | "status" | "metrics" | "lastActivity"
    >,
  ): Connection {
    try {
      return getStorage().createConnection(connection);
    } catch (error) {
      console.error("Error creating connection:", error);
      throw error;
    }
  },

  updateConnection(
    id: string,
    updates: Partial<Connection>,
  ): Connection | undefined {
    try {
      return getStorage().updateConnection(id, updates);
    } catch (error) {
      console.error("Error updating connection:", error);
      return undefined;
    }
  },

  deleteConnection(id: string): boolean {
    try {
      return getStorage().deleteConnection(id);
    } catch (error) {
      console.error("Error deleting connection:", error);
      return false;
    }
  },

  getStorageType(): string {
    return getStorage().getStorageType();
  },

  updateConnectionStatus(id: string, status: Connection["status"]): void {
    try {
      this.updateConnection(id, {
        status,
        lastActivity: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error updating connection status:", error);
    }
  },

  updateConnectionMetrics(
    id: string,
    metrics: Partial<Connection["metrics"]>,
  ): void {
    try {
      const connection = this.getConnection(id);
      if (connection) {
        this.updateConnection(id, {
          metrics: {
            ...connection.metrics,
            ...metrics,
          },
          lastActivity: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error updating connection metrics:", error);
    }
  },

  async testConnection(
    id: string,
  ): Promise<{ connected: boolean; message?: string }> {
    try {
      const connection = this.getConnection(id);
      if (!connection) {
        return { connected: false, message: "Connection not found" };
      }

      this.updateConnectionStatus(id, "testing");

      const result = await this.testConnectionWithDetails({
        url: connection.url,
        authType: connection.authType,
        authentication: connection.authentication,
        validateWidgets: connection.validateWidgets,
      });

      if (result.connected) {
        this.updateConnectionStatus(id, "connected");
        this.updateConnectionMetrics(id, { widgets: result.widgetsCount || 0 });
      } else {
        this.updateConnectionStatus(id, "error");
      }

      return result;
    } catch (error) {
      console.error("Error testing connection:", error);
      this.updateConnectionStatus(id, "error");
      return {
        connected: false,
        message: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  async testConnectionWithDetails(details: {
    url: string;
    authType: Connection["authType"];
    authentication: Array<{
      key: string;
      value: string;
      description?: string;
      location: "header" | "query";
    }>;
    validateWidgets?: boolean;
  }): Promise<{ connected: boolean; message?: string; widgetsCount?: number }> {
    const headers: HeadersInit = {};
    const params = new URLSearchParams();

    if (details.authType === "passxyz-jwt") {
      const token = getPassxyzToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    } else if (details.authType === "custom") {
      for (const auth of details.authentication) {
        if (auth.location === "header") {
          if (!isValidHeaderName(auth.key)) {
            return {
              connected: false,
              message: `Invalid header name: "${auth.key}". Header names can only contain alphanumeric characters and these symbols: - _ ! # $ % & ' * + . \` | ~ ^`,
            };
          }
          headers[auth.key] = auth.value;
        } else {
          params.append(auth.key, auth.value);
        }
      }
    }

    const baseUrl = normalizeBaseUrl(details.url);
    const validateWidgetsEnabled = details.validateWidgets !== false;

    if (validateWidgetsEnabled) {
      const url = `${baseUrl}/widgets.json${params.toString() ? `?${params.toString()}` : ""}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(url, {
          headers,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          return { connected: false, message: `HTTP error: ${response.status}` };
        }

        const data = await response.json();
        if (typeof data !== "object" || data === null || Array.isArray(data)) {
          return {
            connected: false,
            message: "Invalid widgets.json format: expected an object",
          };
        }

        const widgetKeys = Object.keys(data);
        for (const key of widgetKeys) {
          const widget = data[key];
          if (typeof widget !== "object" || widget === null) {
            return {
              connected: false,
              message: `Invalid widget format for key: ${key}`,
            };
          }
          if (typeof widget.widgetId !== "string") {
            return {
              connected: false,
              message: `Missing or invalid widgetId for key: ${key}`,
            };
          }
          if (typeof widget.name !== "string") {
            return {
              connected: false,
              message: `Missing or invalid name for key: ${key}`,
            };
          }
          if (typeof widget.type !== "string") {
            return {
              connected: false,
              message: `Missing or invalid type for key: ${key}`,
            };
          }
          if (typeof widget.category !== "string") {
            return {
              connected: false,
              message: `Missing or invalid category for key: ${key}`,
            };
          }
          if (typeof widget.endpoint !== "string") {
            return {
              connected: false,
              message: `Missing or invalid endpoint for key: ${key}`,
            };
          }
        }

        return { connected: true, widgetsCount: widgetKeys.length };
      } catch (error) {
        clearTimeout(timeoutId);
        console.error("Error testing connection details:", error);
        return {
          connected: false,
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    } else {
      const optionalEndpoints = [
        { name: "widgets", path: "/widgets.json" },
        { name: "agents", path: "/agents.json" },
        { name: "apps", path: "/apps.json" },
        { name: "prompts", path: "/prompts.json" },
      ];

      for (const endpoint of optionalEndpoints) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
          const url = `${baseUrl}${endpoint.path}${params.toString() ? `?${params.toString()}` : ""}`;
          const response = await fetch(url, {
            headers,
            signal: controller.signal,
          });
          clearTimeout(timeoutId);

          if (response.ok) {
            const data = await response.json();
            if (typeof data === "object" && data !== null) {
              const count = Array.isArray(data) ? data.length : Object.keys(data).length;
              return { connected: true, widgetsCount: endpoint.name === "widgets" ? count : 0 };
            }
          }
        } catch (error) {
          clearTimeout(timeoutId);
          console.debug(`Failed to fetch ${endpoint.path}:`, error);
        }
      }

      return {
        connected: false,
        message: "Could not connect to server. No valid endpoints found (widgets.json, agents.json, apps.json, or prompts.json)",
      };
    }
  },

  async refreshConnection(id: string): Promise<Connection | undefined> {
    try {
      const connection = this.getConnection(id);
      if (!connection) {
        return undefined;
      }

      this.updateConnectionStatus(id, "testing");

      const headers: HeadersInit = {};
      const params = new URLSearchParams();

      if (connection.authType === "passxyz-jwt") {
        const token = getPassxyzToken();
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      } else if (connection.authType === "custom") {
        connection.authentication.forEach((auth) => {
          if (auth.location === "header") {
            headers[auth.key] = auth.value;
          } else {
            params.append(auth.key, auth.value);
          }
        });
      }

      const baseUrl = normalizeBaseUrl(connection.url);
      const metrics = {
        widgets: 0,
        apps: 0,
        prompts: 0,
        agents: 0,
      };

      const endpoints = [
        { name: "widgets", path: "/widgets.json" },
        { name: "apps", path: "/apps.json" },
        { name: "prompts", path: "/prompts.json" },
        { name: "agents", path: "/agents.json" },
      ];

      let hasValidEndpoint = false;

      await Promise.all(
        endpoints.map(async (endpoint) => {
          try {
            const endpointController = new AbortController();
            const endpointTimeoutId = setTimeout(
              () => endpointController.abort(),
              10000,
            );

            const url = `${baseUrl}${endpoint.path}${params.toString() ? `?${params.toString()}` : ""}`;
            const response = await fetch(url, {
              headers,
              signal: endpointController.signal,
            });

            clearTimeout(endpointTimeoutId);

            if (response.ok) {
              const data = await response.json();
              if (typeof data === "object" && data !== null) {
                hasValidEndpoint = true;
                if (Array.isArray(data)) {
                  metrics[endpoint.name as keyof typeof metrics] = data.length;
                } else {
                  metrics[endpoint.name as keyof typeof metrics] =
                    Object.keys(data).length;
                }
              }
            }
          } catch (error) {
          }
        }),
      );

      if (hasValidEndpoint) {
        this.updateConnectionStatus(id, "connected");
        this.updateConnectionMetrics(id, metrics);
      } else {
        this.updateConnectionStatus(id, "error");
      }

      return this.getConnection(id);
    } catch (error) {
      console.error("Error in refreshConnection:", error);
      this.updateConnectionStatus(id, "error");
      return undefined;
    }
  },
};