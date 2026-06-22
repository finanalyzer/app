import type { WidgetParameter, ParameterOption } from '../../types/widgets';
import { connectionService } from '../connections/connectionService';

interface ParamOptionsCache {
  [key: string]: {
    options: ParameterOption[];
    timestamp: number;
  };
}

interface FetchOptionsParams {
  parameter: WidgetParameter;
  widgetId: string;
  instanceId: string;
  baseUrl?: string;
}

function normalizeUrl(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

/**
 * Look up authentication headers for a given base URL from saved connections.
 */
function getAuthHeadersForUrl(baseUrl: string): HeadersInit {
  const headers: HeadersInit = {};
  const normalizedUrl = normalizeUrl(baseUrl);
  const connections = connectionService.getConnections();
  const connection = connections.find(
    (conn) => normalizeUrl(conn.url) === normalizedUrl
  );

  if (connection?.authentication) {
    connection.authentication.forEach((auth) => {
      if (auth.location === 'header') {
        headers[auth.key] = auth.value;
      }
    });
  }

  return headers;
}

class ParameterService {
  private optionsCache: ParamOptionsCache = {};
  private cacheDuration = 30000; // 30 seconds
  private fetchPromises: Map<string, Promise<ParameterOption[]>> = new Map();

  /**
   * Fetch options for an endpoint parameter
   */
  private static DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001/api';

  async fetchParamOptions({ parameter, widgetId, instanceId, baseUrl = ParameterService.DEFAULT_BASE_URL }: FetchOptionsParams): Promise<ParameterOption[]> {
    if (!parameter.optionsEndpoint) {
      throw new Error('Endpoint parameter missing optionsEndpoint');
    }

    const cacheKey = `${widgetId}:${instanceId}:${parameter.name}:${parameter.optionsEndpoint}:${baseUrl}`;
    
    // Check if we already have a fetch in progress
    if (this.fetchPromises.has(cacheKey)) {
      return this.fetchPromises.get(cacheKey)!;
    }

    // Check cache
    const cached = this.optionsCache[cacheKey];
    const now = Date.now();
    
    if (cached && (now - cached.timestamp) < this.cacheDuration) {
      return cached.options;
    }

    // Create fetch promise
    const fetchPromise = this.performFetch(parameter, baseUrl, cacheKey);
    this.fetchPromises.set(cacheKey, fetchPromise);

    try {
      const options = await fetchPromise;
      return options;
    } finally {
      this.fetchPromises.delete(cacheKey);
    }
  }

  /**
   * Perform the actual fetch operation
   */
  private async performFetch(
    parameter: WidgetParameter,
    baseUrl: string,
    cacheKey: string
  ): Promise<ParameterOption[]> {
    try {
      const url = this.buildOptionsUrl(parameter, baseUrl);
      // Use connection-aware auth headers (for 3rd-party backends that require them).
      // Do NOT send Content-Type on GET requests — it triggers a CORS preflight
      // that some endpoints may not handle.
      const authHeaders = getAuthHeadersForUrl(baseUrl);
      const response = await fetch(url, {
        method: 'GET',
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch options: ${response.statusText}`);
      }

      const data = await response.json();
      const options = this.processOptionsResponse(data);

      // Cache the results
      this.optionsCache[cacheKey] = {
        options,
        timestamp: Date.now(),
      };

      return options;
    } catch (error) {
      console.error('Error fetching parameter options:', error);
      throw error;
    }
  }

  /**
   * Build the options URL with parameters
   */
  private buildOptionsUrl(parameter: WidgetParameter, baseUrl: string): string {
    const endpoint = parameter.optionsEndpoint!;
    
    if (endpoint.startsWith('http')) {
      const url = endpoint;
      if (parameter.optionsParams) {
        const params = new URLSearchParams();
        Object.entries(parameter.optionsParams).forEach(([key, value]) => {
          params.append(key, String(value));
        });
        return `${url}?${params.toString()}`;
      }
      return url;
    }
    
    // Normalize baseUrl: strip trailing slash, preserve path to allow
    // baseUrl like http://localhost:8001/api to contribute /api prefix to the URL.
    // Avoid path duplication (e.g. baseUrl=/api + endpoint=/api/v1/... → /api/api/v1/...)
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    
    let url: string;
    try {
      const baseParsed = new URL(normalizedBase);
      const basePath = baseParsed.pathname.replace(/\/$/, '') || '/';
      if (basePath !== '/' && normalizedEndpoint.startsWith(basePath)) {
        // Endpoint already includes the base path, avoid duplication
        url = `${baseParsed.origin}${normalizedEndpoint}`;
      } else {
        url = `${normalizedBase}${normalizedEndpoint}`;
      }
    } catch {
      // If not a valid absolute URL, concatenate directly
      url = `${normalizedBase}${normalizedEndpoint}`;
    }
    
    if (parameter.optionsParams) {
      const params = new URLSearchParams();
      Object.entries(parameter.optionsParams).forEach(([key, value]) => {
        params.append(key, String(value));
      });
      return `${url}?${params.toString()}`;
    }
    
    return url;
  }

  /**
   * Process the API response into options format
   */
  private processOptionsResponse(data: unknown): ParameterOption[] {
    if (Array.isArray(data)) {
      return data.map(item => {
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          const result: ParameterOption = {
            value: obj.value !== undefined ? obj.value : obj.id || obj.symbol,
            label: obj.label !== undefined ? String(obj.label) : String(obj.name || obj.value || obj.id || obj.symbol),
          };
          // Preserve extraInfo for Advanced Dropdown
          if (obj.extraInfo && typeof obj.extraInfo === 'object') {
            const extra = obj.extraInfo as Record<string, unknown>;
            result.extraInfo = {
              description: typeof extra.description === 'string' ? extra.description : undefined,
              rightOfDescription: typeof extra.rightOfDescription === 'string' ? extra.rightOfDescription : undefined,
            };
          }
          return result;
        }
        return {
          value: item,
          label: String(item),
        };
      });
    }

    if (typeof data === 'object' && data !== null) {
      const dataObj = data as Record<string, unknown>;
      if (dataObj.options) {
        return this.processOptionsResponse(dataObj.options);
      }
      if (dataObj.items) {
        return this.processOptionsResponse(dataObj.items);
      }
    }
    
    return [];
  }

  /**
   * Clear cache for a specific parameter
   */
  clearCache(widgetId: string, instanceId: string, parameterName: string): void {
    const keys = Object.keys(this.optionsCache).filter(key => 
      key.startsWith(`${widgetId}:${instanceId}:${parameterName}:`)
    );
    
    keys.forEach(key => {
      delete this.optionsCache[key];
    });
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.optionsCache = {};
    this.fetchPromises.clear();
  }

  /**
   * Validate parameter values
   */
  validateParameter(parameter: WidgetParameter, value: unknown): boolean {
    if (parameter.required && (value === undefined || value === null || value === '')) {
      return false;
    }

    switch (parameter.type) {
      case 'number': {
        if (typeof value !== 'number' && typeof value !== 'string') {
          return false;
        }
        const numValue = typeof value === 'string' ? parseFloat(value) : value;
        if (isNaN(numValue as number)) {
          return false;
        }
        if (parameter.min !== undefined && (numValue as number) < parameter.min) {
          return false;
        }
        if (parameter.max !== undefined && (numValue as number) > parameter.max) {
          return false;
        }
        return true;
      }

      case 'date':
        return !isNaN(Date.parse(String(value)));

      case 'select':
        if (!parameter.options) {
          return true;
        }
        return parameter.options.some(option => option.value === value);

      case 'endpoint':
        // Endpoint parameters are validated by the API
        return true;

      case 'form':
        // Form parameters are validated on submission
        return true;

      default:
        return true;
    }
  }

  /**
   * Search for tickers (type-ahead search for ticker parameter)
   */
  async searchTickers(params: {
    query: string;
    widgetId: string;
    instanceId: string;
    baseUrl?: string;
    paramName?: string;
  }): Promise<ParameterOption[]> {
    const { query, baseUrl = ParameterService.DEFAULT_BASE_URL, paramName = 'symbol' } = params;

    if (!query.trim()) {
      return [];
    }

    // Build the ticker search URL
    const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
    const searchPath = `/api/v1/widgets/ticker_search`;
    let url: string;

    try {
      const baseParsed = new URL(normalizedBase);
      const basePath = baseParsed.pathname.replace(/\/$/, '') || '/';
      if (basePath !== '/' && searchPath.startsWith(basePath)) {
        url = `${baseParsed.origin}${searchPath}`;
      } else {
        url = `${normalizedBase}${searchPath}`;
      }
    } catch {
      url = `${normalizedBase}${searchPath}`;
    }

    // Add query params
    const separator = url.includes('?') ? '&' : '?';
    url = `${url}${separator}query=${encodeURIComponent(query)}&param_name=${encodeURIComponent(paramName)}`;

    try {
      const authHeaders = getAuthHeadersForUrl(baseUrl);
      const response = await fetch(url, {
        method: 'GET',
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error(`Ticker search failed: ${response.statusText}`);
      }

      const data = await response.json();
      return this.processOptionsResponse(data);
    } catch (error) {
      console.error('Error searching tickers:', error);
      return [];
    }
  }

  /**
   * Submit form parameter data
   */
  async submitFormParameter(
    parameter: WidgetParameter,
    formData: Record<string, unknown>,
    connectionUrl: string = ''
  ): Promise<unknown> {
    if (!parameter.endpoint) {
      throw new Error('Form parameter missing endpoint');
    }

    // Compose URL properly
    const isFullUrl = parameter.endpoint.startsWith('http://') || parameter.endpoint.startsWith('https://');
    let url: string;
    let authLookupUrl: string;
    if (isFullUrl) {
      url = parameter.endpoint;
      // Look up auth by extracting the origin from the full endpoint URL
      authLookupUrl = new URL(parameter.endpoint).origin;
    } else {
      // Normalize connectionUrl: remove trailing slash
      const normalizedBaseUrl = connectionUrl.endsWith('/') 
        ? connectionUrl.slice(0, -1) 
        : connectionUrl;
      
      // Ensure endpoint starts with /
      const normalizedEndpoint = parameter.endpoint.startsWith('/') 
        ? parameter.endpoint 
        : `/${parameter.endpoint}`;
      
      url = `${normalizedBaseUrl}${normalizedEndpoint}`;
      authLookupUrl = normalizedBaseUrl;
    }

    try {
      const authHeaders = getAuthHeadersForUrl(authLookupUrl);
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`Form submission failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error submitting form parameter:', error);
      throw error;
    }
  }
}

export const parameterService = new ParameterService();
export type { FetchOptionsParams };