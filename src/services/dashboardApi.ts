import { connectionService } from "./connections/connectionService";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

function normalizeUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function getAuthHeaders(): HeadersInit {
  const headers: HeadersInit = {};
  
  if (!API_BASE_URL) {
    return headers;
  }

  const normalizedApiUrl = normalizeUrl(API_BASE_URL);
  const connections = connectionService.getConnections();
  const connection = connections.find(
    (conn) => normalizeUrl(conn.url) === normalizedApiUrl
  );

  if (connection?.authentication) {
    connection.authentication.forEach((auth) => {
      if (auth.location === "header") {
        headers[auth.key] = auth.value;
      }
    });
  }

  return headers;
}

function buildUrl(path: string): string {
  const queryParams = new URLSearchParams();
  
  if (!API_BASE_URL) {
    return path;
  }

  const normalizedApiUrl = normalizeUrl(API_BASE_URL);
  const connections = connectionService.getConnections();
  const connection = connections.find(
    (conn) => normalizeUrl(conn.url) === normalizedApiUrl
  );

  if (connection?.authentication) {
    connection.authentication.forEach((auth) => {
      if (auth.location === "query") {
        queryParams.append(auth.key, auth.value);
      }
    });
  }

  const queryString = queryParams.toString();
  return `${API_BASE_URL}${path}${queryString ? `?${queryString}` : ""}`;
}

export interface Widget {
  id: string;
  type: string;
  title: string;
  position: Record<string, unknown>;
  data?: Record<string, unknown>;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  widgets: Widget[];
  created_at?: string;
  updated_at?: string;
  tabs?: Array<{ id: string; name: string; icon?: string }>;
}

export interface DashboardCreate {
  id: string;
  name: string;
  description?: string;
  widgets?: Widget[];
  tabs?: Array<{ id: string; name: string; icon?: string }>;
}

export interface DashboardUpdate {
  name?: string;
  description?: string;
  widgets?: Widget[];
  tabs?: Array<{ id: string; name: string; icon?: string }>;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = body.detail || detail;
    } catch {
      // Response body is not JSON, use status text
    }
    throw new Error(`Dashboard API error (${response.status}): ${detail}`);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export async function getDashboards(): Promise<Dashboard[]> {
  const response = await fetch(buildUrl("/v1/dashboard"), {
    headers: getAuthHeaders(),
  });
  return handleResponse<Dashboard[]>(response);
}

export async function getDashboard(id: string): Promise<Dashboard> {
  const response = await fetch(buildUrl(`/v1/dashboard/${id}`), {
    headers: getAuthHeaders(),
  });
  return handleResponse<Dashboard>(response);
}

export async function createDashboard(data: DashboardCreate): Promise<Dashboard> {
  const response = await fetch(buildUrl("/v1/dashboard"), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse<Dashboard>(response);
}

export async function updateDashboard(
  id: string,
  data: DashboardUpdate,
): Promise<Dashboard> {
  const response = await fetch(buildUrl(`/v1/dashboard/${id}`), {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(data),
  });
  return handleResponse<Dashboard>(response);
}

export async function deleteDashboard(id: string): Promise<void> {
  const response = await fetch(buildUrl(`/v1/dashboard/${id}`), {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  return handleResponse<void>(response);
}

export async function addWidget(
  dashboardId: string,
  widget: Widget,
): Promise<Widget> {
  const response = await fetch(buildUrl(`/v1/dashboard/${dashboardId}/widgets`), {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(widget),
  });
  return handleResponse<Widget>(response);
}

export async function updateWidget(
  dashboardId: string,
  widgetId: string,
  data: Partial<Widget>,
): Promise<Widget> {
  const response = await fetch(
    buildUrl(`/v1/dashboard/${dashboardId}/widgets/${encodeURIComponent(widgetId)}`),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      body: JSON.stringify(data),
    },
  );
  return handleResponse<Widget>(response);
}

export async function deleteWidget(
  dashboardId: string,
  widgetId: string,
): Promise<void> {
  const response = await fetch(
    buildUrl(`/v1/dashboard/${dashboardId}/widgets/${encodeURIComponent(widgetId)}`),
    { method: "DELETE", headers: getAuthHeaders() },
  );
  return handleResponse<void>(response);
}
