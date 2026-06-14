// Widget interface definitions and types

// Cell Click Grouping - Render function parameters
export interface CellOnClickRenderParams {
  actionType: "groupBy";
  groupByParamName?: string;
  groupBy?: {
    paramName: string;
    valueField?: string;
  };
}

// Cell Click Grouping - Group configuration
export interface Group {
  name: string;
  type: string;
  paramName: string;
  defaultValue: string | number | boolean;
  widgetIds: string[];
}

// Column definition with render function support
export interface ColumnDef {
  field: string;
  headerName?: string;
  headerTooltip?: string;
  cellDataType?: string;
  pinned?: "left" | "right" | null;
  formatterFn?: string;
  renderFn?: "columnColor" | "cellOnClick";
  renderFnParams?: Record<string, unknown> | CellOnClickRenderParams;
  filter?: boolean;
  sortable?: boolean;
  resizable?: boolean;
  flex?: number;
  minWidth?: number;
  width?: number;
  colorRules?: Array<{
    condition: string;
    value?: unknown;
    color: string;
    range?: { min?: number; max?: number };
  }>;
}

// Widget parameter types
export type WidgetParameterType = 'string' | 'number' | 'boolean' | 'select' | 'date' | 'color' | 'endpoint' | 'form' | 'tabs';

// Form input parameter definition
export interface FormInputParameter {
  paramName: string;
  type: string;
  label: string;
  description?: string;
  value?: string | number;
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
}

// Widget parameter definition
export interface WidgetParameter {
  name: string;
  type: WidgetParameterType;
  label: string;
  description?: string;
  default?: unknown;
  value?: unknown;
  required?: boolean;
  options?: Array<{ value: unknown; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  // For endpoint type
  optionsEndpoint?: string;
  optionsParams?: Record<string, unknown>;
  // For form type
  endpoint?: string;
  inputParams?: FormInputParameter[];
  // Common properties
  dependsOn?: string[];
  show?: boolean;
  optional?: boolean;
  // For compatibility with different backend formats
  paramName?: string;
}

// Type guard for endpoint parameters
export function isEndpointParameter(param: WidgetParameter): param is WidgetParameter & { type: 'endpoint'; optionsEndpoint: string } {
  return param.type === 'endpoint' && !!param.optionsEndpoint;
}

// Type guard for form parameters
export function isFormParameter(param: WidgetParameter): param is WidgetParameter & { type: 'form'; endpoint: string; inputParams: FormInputParameter[] } {
  return param.type === 'form' && !!param.endpoint && !!param.inputParams;
}

// Widget configuration
export interface WidgetConfig {
  id: string;
  name: string;
  description: string;
  type: string;
  category: string;
  subcategory: string;
  endpoint: string;
  gridData: {
    w: number;
    h: number;
  };
  params: WidgetParameter[];
  source: string;
  connectionId?: string;
  connectionName?: string;
  connectionUrl?: string;
  connectionStatus?: 'connected' | 'disconnected' | 'error' | 'testing';
  connectionAuthentication?: Array<{
    key: string;
    value: string;
    description?: string;
    location: 'header' | 'query';
  }>;
  // Widget data configuration (table columnsDefs, etc.)
  data?: unknown;
  // MCP tool matching metadata
  mcpToolMatch?: {
    serverName: string;
    toolName: string;
  };
}

// Widget instance data
export interface WidgetInstance extends WidgetConfig {
  instanceId: string;
  dashboardId: string;
  position: {
    x: number;
    y: number;
  };
  currentParams: Record<string, unknown>;
  lastUpdated?: string;
  data?: {
    groups?: Group[];
    tableConfig?: Record<string, unknown>;
    [key: string]: unknown;
  };
  error?: string;
  // Table configuration for table widgets (columnsDefs, etc.)
  tableConfig?: Record<string, unknown>;
  // New state properties for enhanced parameter system
  paramOptions?: Record<string, Array<{ value: unknown; label: string }>>;
  optionsLoading?: Record<string, boolean>;
  formErrors?: Record<string, string>;
}

// Widget data response
export interface WidgetDataResponse {
  data: unknown;
  timestamp: string;
  widgetId: string;
  instanceId: string;
}

// Widget mode type
export type WidgetMode = 'debug' | 'production';

// Widget type registry
export interface WidgetTypeDefinition {
  type: string;
  displayName: string;
  description: string;
  defaultGridData: {
    w: number;
    h: number;
  };
  supportedParameters: WidgetParameter[];
  renderer: React.ComponentType<WidgetInstanceProps>;
  modeConfig?: {
    debug?: {
      enabled: boolean;
      showDebugInfo?: boolean;
      default?: boolean;
    };
    production?: {
      enabled: boolean;
      optimizePerformance?: boolean;
    };
  };
}

// Props for widget instance components
export interface WidgetInstanceProps {
  widget: WidgetInstance;
  mode?: WidgetMode;
  onUpdate?: (params: Record<string, unknown>) => void;
  onRefresh?: () => void;
  onParametersChange?: (params: WidgetParameter[], values: Record<string, unknown>) => void;
}

// Base widget class
export abstract class BaseWidget {
  protected config: WidgetConfig;
  protected instanceId: string;
  protected currentParams: Record<string, unknown>;

  constructor(config: WidgetConfig, instanceId: string, params?: Record<string, unknown>) {
    this.config = config;
    this.instanceId = instanceId;
    this.currentParams = params || this.getDefaultParams();
  }

  // Get default parameters based on widget config
  getDefaultParams(): Record<string, unknown> {
    const defaultParams: Record<string, unknown> = {};
    this.config.params.forEach((param) => {
      if (param.default !== undefined) {
        defaultParams[param.name] = param.default;
      }
    });
    return defaultParams;
  }

  // Update parameters
  updateParams(params: Record<string, unknown>): void {
    this.currentParams = { ...this.currentParams, ...params };
  }

  // Get current parameters
  getParams(): Record<string, unknown> {
    return { ...this.currentParams };
  }

  // Get widget config
  getConfig(): WidgetConfig {
    return this.config;
  }

  // Get instance ID
  getInstanceId(): string {
    return this.instanceId;
  }

  // Abstract method to fetch data
  abstract fetchData(): Promise<WidgetDataResponse>;

  // Abstract method to validate parameters
  abstract validateParams(params: Record<string, unknown>): boolean;
}
