import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Input, Label, Select, Textarea } from "@openbb/ui";
import { useTranslation } from "react-i18next";
import { WidgetFactory } from "../../services/widgets/widgetFactory";
import { widgetService } from "../../services/widgets/widgetService";
import type {
  WidgetConfig,
  WidgetInstance,
  WidgetInstanceProps,
  WidgetParameter,
  WidgetParameterType,
} from "../../types/widgets";
import "../dashboard/DashboardCanvas.css";
import { ParameterInput } from "../dashboard/ParameterInput";
import { WidgetWrapper } from "./WidgetWrapper";

// Type for processed parameters with resolved names
type ProcessedParameter = WidgetParameter & { paramName: string };

// Magic string constants
const WIDGET_TYPE_DEBUG = "debug";
const DEFAULT_WIDGET_GRID_DATA = { w: 4, h: 3 };

// Get built-in widgets from WidgetFactory (single source of truth)
function getBuiltInWidgets(): WidgetConfig[] {
  return WidgetFactory.getWidgetTypes().map((typeDef) => ({
    id: `built-in-${typeDef.type}`,
    name: typeDef.displayName,
    description: typeDef.description,
    type: typeDef.type,
    category: "Core",
    subcategory: "Built-in",
    endpoint: "",
    gridData: typeDef.defaultGridData,
    params: typeDef.supportedParameters,
    source: "built-in",
  }));
}

type TabId = "definition" | "parameters";
type ViewMode = "preview" | "debug";

type ParamRecord = Record<string, unknown>;

interface DebugData {
  widgetId?: string;
  connectionId?: string;
  widgetConfig?: WidgetConfig;
}

function getParamName(p: WidgetParameter | undefined | null): string {
  if (!p) return "unknown";
  const r = p as unknown as ParamRecord;
  return (r.paramName as string) || p.name || "unknown";
}

function getWidgetId(w: WidgetConfig): string {
  const r = w as unknown as ParamRecord;
  return w.id || (r.widgetId as string) || "";
}

function DebugWidget({
  widget,
  viewMode = "preview",
  activeTab = "definition",
  onParametersChange,
  onWidgetUpdate,
}: WidgetInstanceProps & {
  viewMode?: ViewMode;
  activeTab?: TabId;
  onParametersChange?: (params: ProcessedParameter[], values: Record<string, unknown>) => void;
  onWidgetUpdate?: (widgetData: { id: string; data: DebugData }) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [widgetDef, setWidgetDef] = useState<WidgetConfig | null>(null);
  const [widgetIdInput, setWidgetIdInput] = useState<string>("");
  const [jsonInput, setJsonInput] = useState("");
  const jsonInputRef = useRef(jsonInput);
  jsonInputRef.current = jsonInput;
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [resolvedParams, setResolvedParams] = useState<Record<string, unknown>>(
    {},
  );
  const [paramValues, setParamValues] = useState<Record<string, unknown>>({});
  const [fetchLoading, setFetchLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<WidgetConfig[]>(getBuiltInWidgets());
  const [isLoading, setIsLoading] = useState(false);
  const [responseData, setResponseData] = useState<string>("");
  const [fetchedData, setFetchedData] = useState<unknown>(null);
  const consoleGroupRef = useRef<string | null>(null);

  const widgetData = (widget.data || {}) as DebugData;
  const lastWidgetConfigRef = useRef<string | null>(null);
  const hasLoadedDefault = useRef(false);

  // Initialize widget definition on mount or when widget.data changes
  useEffect(() => {
    const initWidgetDef = async () => {
      // If widget already has a config from parent data, use it (e.g., after Apply Definition causes remount)
      if (widgetData.widgetConfig) {
        const configId = getWidgetId(widgetData.widgetConfig);
        if (configId !== lastWidgetConfigRef.current) {
          lastWidgetConfigRef.current = configId;
          setWidgetDef(widgetData.widgetConfig);
          setWidgetIdInput(widgetData.widgetId || configId);
          setJsonInput(JSON.stringify(widgetData.widgetConfig, null, 2));
          initParams(widgetData.widgetConfig);
        }
        return;
      }

      // Otherwise, load the default JSON file (only once)
      if (!hasLoadedDefault.current) {
        hasLoadedDefault.current = true;
        try {
          const response = await fetch('/test-widget.json');
          if (response.ok) {
            const defaultWidgetConfig = await response.json();
            const widgetId = getWidgetId(defaultWidgetConfig);
            lastWidgetConfigRef.current = widgetId;
            setWidgetDef(defaultWidgetConfig);
            setWidgetIdInput(widgetId);
            setJsonInput(JSON.stringify(defaultWidgetConfig, null, 2));
            initParams(defaultWidgetConfig);
            
            // Notify parent component to update widget data
            // Keep widget.id unchanged to prevent React key change (remount)
            if (onWidgetUpdate) {
              onWidgetUpdate({
                id: widget.id,
                data: {
                  widgetId,
                  widgetConfig: defaultWidgetConfig
                }
              });
            }
          } else {
            console.warn('Failed to load default widget JSON:', response.status);
          }
        } catch (error) {
          console.warn('Error loading default widget JSON:', error);
        }
      }
    };

    initWidgetDef();
  }, [widget.data]);

  // Synchronize internal state with parent's currentParams
  useEffect(() => {
    if (widget.currentParams && Object.keys(widget.currentParams).length > 0) {
      setResolvedParams(widget.currentParams);
      setParamValues(widget.currentParams);
    }
  }, [widget.currentParams]);

  useEffect(() => {
    const loadWidgets = async () => {
      setIsLoading(true);
      try {
        // Use widgetService as single source of truth (includes built-ins + connections)
        const allWidgets = await widgetService.getWidgets();
        const uniqueWidgets = Array.from(
          new Map(allWidgets.map((w) => [getWidgetId(w), w])).values(),
        );
        setWidgets(uniqueWidgets);
      } catch (e) {
        console.error("Error loading widgets:", e);
        // Fallback: at least show built-in widget names
        setWidgets(getBuiltInWidgets());
      } finally {
        setIsLoading(false);
      }
    };

    loadWidgets();
  }, []);

  const widgetId = widgetDef?.id || widgetDef?.endpoint || "unknown";

  const openConsoleGroup = useCallback(() => {
    if (consoleGroupRef.current) {
      console.groupEnd();
    }
    const label = `[Debug] DebugWidget: ${widgetId}`;
    console.group(label);
    consoleGroupRef.current = label;
  }, [widgetId]);

  const closeConsoleGroup = useCallback(() => {
    if (consoleGroupRef.current) {
      console.groupEnd();
      consoleGroupRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (consoleGroupRef.current) {
        console.groupEnd();
      }
    };
  }, []);

  const loadWidgetById = useCallback(async () => {
    setLoadError(null);
    setJsonError(null);
    setValidationErrors([]);

    if (!widgetIdInput.trim()) {
      setLoadError(t("debugWidget.pleaseEnterWidgetId"));
      return;
    }

    try {
      // Try to load from widget service first (this handles dropdown selection)
      const widgets = await widgetService.getWidgets();
      const ids = widgets.map(getWidgetId);
      const found = widgets.find(
        (w) =>
          w.id === widgetIdInput.trim() ||
          getWidgetId(w) === widgetIdInput.trim(),
      );

      if (found) {
        setWidgetDef(found);
        setJsonInput(JSON.stringify(found, null, 2));
        initParams(found);
        return;
      }

      // If not found in service, check if there's a JSON definition in the textarea
      if (jsonInput.trim()) {
        const parsed = parseJsonInput();
        if (parsed) {
          const jsonWidgetId = getWidgetId(parsed);
          if (jsonWidgetId !== widgetIdInput.trim()) {
            setLoadError(
              t("debugWidget.widgetIdMismatch", {
                inputId: widgetIdInput.trim(),
                jsonId: jsonWidgetId,
              }),
            );
            return;
          }
          // Use the JSON definition
          setWidgetDef(parsed);
          initParams(parsed);
          return;
        }
      }

      // Widget not found anywhere
      setLoadError(
        `Widget not found: ${widgetIdInput.trim()}. Please check the widget ID and try again. Available widget IDs: ${ids.slice(0, 10).join(", ")}${ids.length > 10 ? "..." : ""}`
      );
    } catch (e) {
      setLoadError(
        t("debugWidget.errorLoadingWidgets", {
          error: e instanceof Error ? e.message : "Unknown error",
        }),
      );
    }
  }, [widgetIdInput, jsonInput, t]);

  const parseJsonInput = (): WidgetConfig | null => {
    try {
      const parsed = JSON.parse(jsonInputRef.current);
      setJsonError(null);
      return parsed as WidgetConfig;
    } catch (e) {
      const errorMessage = e instanceof Error 
        ? `JSON parse error: ${e.message}. Please check your JSON syntax.` 
        : "Invalid JSON. Please check your JSON syntax.";
      setJsonError(errorMessage);
      return null;
    }
  };

  const validateDefinition = (def: WidgetConfig): string[] => {
    const errors: string[] = [];
    if (!def.endpoint) errors.push("Missing required field: endpoint");
    if (!def.type) errors.push("Missing required field: type");
    if (!def.id && !(def as unknown as ParamRecord).widgetId)
      errors.push("Missing required field: id or widgetId");
    return errors;
  };

  const handleApplyDefinition = useCallback(() => {
    const parsed = parseJsonInput();
    if (!parsed) return;

    const errors = validateDefinition(parsed);
    setValidationErrors(errors);

    if (errors.length > 0) return;

    const normalized: WidgetConfig = {
      ...parsed,
      id:
        parsed.id ||
        ((parsed as unknown as ParamRecord).widgetId as string) ||
        "",
      params: parsed.params || [],
      gridData: parsed.gridData || DEFAULT_WIDGET_GRID_DATA,
      source: parsed.source || "manual",
      category: parsed.category || "debug",
      subcategory: parsed.subcategory || "tools",
      name: parsed.name || "Debug Widget",
      description: parsed.description || "Debug widget",
    };

    const normalizedId = getWidgetId(normalized);

    setWidgetDef(normalized);
    setWidgetIdInput(normalizedId);
    setJsonInput(JSON.stringify(normalized, null, 2));
    lastWidgetConfigRef.current = normalizedId;
    initParams(normalized);
    openConsoleGroup();

    // Persist the widget definition to parent component.
    // Keep the current widget.id to prevent React key change (remount).
    // The applied definition's ID is stored in data.widgetId instead.
    if (onWidgetUpdate) {
      onWidgetUpdate({
        id: widget.id,
        data: {
          widgetId: normalizedId,
          widgetConfig: normalized
        }
      });
    }
  }, [openConsoleGroup, onWidgetUpdate, widget.id]);

  const initParams = (def: WidgetConfig) => {
    const defaults: Record<string, unknown> = {};
    const resolved: Record<string, unknown> = {};
    const processedParams: ProcessedParameter[] = [];

    ((def.params || (def.data as Record<string, unknown>)?.params) || []).forEach((p) => {
      const paramName = getParamName(p);
      const pRec = p as unknown as ParamRecord;
      const val = pRec.value !== undefined ? pRec.value : p.default;

      defaults[paramName] = val;
      resolved[paramName] = val;
      // Create a copy of the parameter with the correct name
      processedParams.push({
        ...p,
        name: paramName,
        paramName: paramName,
      } as ProcessedParameter);
    });

    setParamValues(defaults);
    setResolvedParams(resolved);

    // Notify parent component about parameters
    if (onParametersChange) {
      onParametersChange(processedParams, resolved);
    }
  };

  const handleParamChange = useCallback((paramName: string, value: unknown) => {
    // Update state first
    const newValues = { ...paramValues, [paramName]: value };
    setParamValues(newValues);

    const newResolvedParams = { ...resolvedParams, [paramName]: value };
    setResolvedParams(newResolvedParams);

    // Notify parent component about parameter changes after state updates
    if (onParametersChange && widgetDef) {
      // Create processed params with correct names
      const processedParams: ProcessedParameter[] = [];

      ((widgetDef.params || (widgetDef.data as Record<string, unknown>)?.params) || []).forEach((p) => {
        const paramName = getParamName(p);
        // Create a copy of the parameter with the correct name
        processedParams.push({
          ...p,
          name: paramName,
          paramName: paramName,
        } as ProcessedParameter);
      });

      onParametersChange(processedParams, newValues);
    }
  }, [paramValues, resolvedParams, widgetDef, onParametersChange]);

  const getComposedUrl = useMemo(() => {
    if (!widgetDef) return "";

    const endpoint = widgetDef.endpoint;
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
    
    // Check if endpoint is a full URL (starts with http:// or https://)
    const isFullUrl = endpoint.startsWith('http://') || endpoint.startsWith('https://');
    
    let url: string;
    
    if (isFullUrl) {
      // If endpoint is a full URL, use it directly without connectionUrl
      url = endpoint;
    } else {
      // For proxy endpoint, use API_BASE_URL
      if (endpoint.startsWith('/v1/proxy')) {
        const normalizedBaseUrl = API_BASE_URL.endsWith('/')
          ? API_BASE_URL.slice(0, -1)
          : API_BASE_URL;
        url = `${normalizedBaseUrl}${endpoint}`;
      } else {
        const connectionUrl = widgetDef.connectionUrl || "";
        
        // Normalize connectionUrl: remove trailing slash
        const normalizedBaseUrl = connectionUrl.endsWith('/')
          ? connectionUrl.slice(0, -1)
          : connectionUrl;
        
        // Ensure endpoint starts with /
        const normalizedEndpoint = endpoint.startsWith('/')
          ? endpoint
          : `/${endpoint}`;
        
        url = `${normalizedBaseUrl}${normalizedEndpoint}`;
      }
    }

    const queryParams = new URLSearchParams();
    Object.entries(resolvedParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") {
        queryParams.append(key, String(value));
      }
    });

    const finalUrl = queryParams.toString()
      ? `${url}?${queryParams.toString()}`
      : url;

    return finalUrl;
  }, [widgetDef, resolvedParams]);

  const handleFetchData = async () => {
    if (!widgetDef) {
      setLoadError(
        "No widget definition loaded. Load or paste a definition first.",
      );
      return;
    }

    setFetchLoading(true);
    openConsoleGroup();

    // Remove any backticks from the URL
    const fullUrl = getComposedUrl.replace(/[`]/g, '');

    // Build authentication headers
    const headers: HeadersInit = {};
    const authQueryParams = new URLSearchParams();
    
    if (widgetDef.connectionAuthentication) {
      widgetDef.connectionAuthentication.forEach((auth) => {
        if (auth.location === 'header') {
          headers[auth.key] = auth.value;
        } else {
          authQueryParams.append(auth.key, auth.value);
        }
      });
    }

    // Combine auth query params with widget params
    const urlParts = fullUrl.split('?');
    const finalParams = new URLSearchParams(authQueryParams.toString());
    if (urlParts[1]) {
      const existingParams = new URLSearchParams(urlParts[1]);
      existingParams.forEach((value, key) => {
        finalParams.append(key, value);
      });
    }
    
    const finalUrl = finalParams.toString()
      ? `${urlParts[0]}?${finalParams.toString()}`
      : urlParts[0];

    console.dir(
      {
        type: "REQUEST",
        method: "GET",
        url: finalUrl,
        headers: Object.keys(headers).length > 0 ? headers : undefined,
        queryParameters: Object.fromEntries(finalParams.entries()),
      },
      { depth: null },
    );

    const startTime = performance.now();

    try {
      const response = await fetch(finalUrl, { headers });
      const elapsed = performance.now() - startTime;

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        const errorData = {
          type: "ERROR",
          status: response.status,
          statusText: response.statusText,
          url: fullUrl,
          elapsed: `${elapsed.toFixed(1)}ms`,
          body: errorBody,
          message: `API call failed with status ${response.status}: ${response.statusText}. Please check the endpoint URL and parameters.`,
        };
        console.error(errorData);
        setResponseData(JSON.stringify(errorData, null, 2));
        return;
      }

      const contentType = response.headers.get("content-type") || "unknown";
      let data: unknown;

      if (contentType.includes("application/json")) {
        data = await response.json();
      } else if (contentType.includes("text/html")) {
        const htmlContent = await response.text();
        data = { content: htmlContent, type: "html" };
      } else {
        data = await response.text();
      }

      const elapsedStr = `${elapsed.toFixed(1)}ms`;

      // Handle dataKey if defined in widgetDef
      let processedData = data;
      if (widgetDef && 'data' in widgetDef && widgetDef.data) {
        const widgetData = widgetDef.data;
        if (typeof widgetData === 'object' && widgetData !== null && 'dataKey' in widgetData) {
          const dataKey = widgetData.dataKey;
          if (typeof dataKey === 'string' && typeof data === 'object' && data !== null) {
            const dataObj = data as Record<string, unknown>;
            if (dataKey in dataObj) {
              processedData = dataObj[dataKey];
            }
          }
        }
      }

      // Convert single object to array for table display
      if (processedData && typeof processedData === 'object' && !Array.isArray(processedData)) {
        processedData = [processedData];
      }

      const responseObj = {
        type: "RESPONSE",
        status: response.status,
        contentType,
        elapsed: elapsedStr,
        body: data,
        processedData: processedData,
      };

      console.info(`Response time: ${elapsedStr}`);
      console.dir(responseObj, { depth: null });
      setResponseData(JSON.stringify(responseObj, null, 2));
      setFetchedData(processedData);
    } catch (e) {
      const elapsed = performance.now() - startTime;
      const errorMessage = e instanceof Error 
        ? `Network error: ${e.message}. Please check your network connection and try again.` 
        : "Unknown network error. Please check your network connection and try again.";
      const errorData = {
        type: "ERROR",
        message: errorMessage,
        url: fullUrl,
        elapsed: `${elapsed.toFixed(1)}ms`,
      };
      console.error(errorData);
      setResponseData(JSON.stringify(errorData, null, 2));
    } finally {
      setFetchLoading(false);
      closeConsoleGroup();
    }
  };

  // Process data for preview
  const processedPreviewData = useMemo(() => {
    let dataToProcess = fetchedData || widget.data;

    // Handle dataKey if defined in widgetDef
    if (widgetDef && 'data' in widgetDef && widgetDef.data) {
      const widgetData = widgetDef.data;
      if (typeof widgetData === 'object' && widgetData !== null && 'dataKey' in widgetData) {
        const dataKey = widgetData.dataKey;
        if (typeof dataKey === 'string' && typeof dataToProcess === 'object' && dataToProcess !== null) {
          const dataObj = dataToProcess as Record<string, unknown>;
          if (dataKey in dataObj) {
            dataToProcess = dataObj[dataKey] as typeof dataToProcess;
          }
        }
      }
    }

    // Handle HTML widget - check both type and data structure
    // If data has 'content' and 'type' properties and type is 'html', it's HTML content
    if (widgetDef && 
        (widgetDef.type === 'html' || 
         (typeof dataToProcess === 'object' && dataToProcess !== null && 'content' in dataToProcess))) {
      // If dataToProcess is a string, wrap it in { content: dataToProcess, type: 'html' }
      if (typeof dataToProcess === 'string') {
        return { content: dataToProcess, type: 'html' };
      }
      // If dataToProcess is an array, use the first element (common case for API responses)
      if (Array.isArray(dataToProcess) && dataToProcess.length > 0) {
        const firstElement = dataToProcess[0];
        if (typeof firstElement === 'object' && firstElement !== null && 'content' in firstElement) {
          return firstElement;
        }
      }
      // If dataToProcess is already an object with content, return it as is
      // (don't convert to array - HtmlRenderer expects an object)
      if (typeof dataToProcess === 'object' && dataToProcess !== null && 'content' in dataToProcess) {
        return dataToProcess;
      }
    }

    // Convert single object to array for table display
    if (dataToProcess && typeof dataToProcess === 'object' && !Array.isArray(dataToProcess)) {
      dataToProcess = [dataToProcess];
    }

    return dataToProcess;
  }, [widgetDef, fetchedData, widget.data]);

  // Create a stable mock widget instance for preview
  // Set endpoint to empty string to prevent BaseWidget from fetching data via useWidgetData
  // BaseWidget will then use widget.data instead of the fetched data
  const previewWidget = useMemo((): WidgetInstance | null => {
    if (!widgetDef) return null;

    return {
      ...widgetDef,
      endpoint: "", // Empty endpoint disables useWidgetData in BaseWidget
      instanceId: `preview-${widgetDef.id}`,
      dashboardId: "debug-dashboard",
      position: { x: 0, y: 0 },
      currentParams: resolvedParams,
      lastUpdated: new Date().toISOString(),
      data: processedPreviewData,
    };
  }, [widgetDef, resolvedParams, processedPreviewData]);

  const handlePreviewUpdate = useCallback((params: Record<string, unknown>) => {
    // Ensure all parameter keys are valid strings
    const validParams: Record<string, unknown> = {};
    Object.entries(params).forEach(([key, value]) => {
      if (key && typeof key === "string") {
        validParams[key] = value;
      } else {
        console.warn("Invalid key detected in handlePreviewUpdate:", {
          key,
          value,
        });
      }
    });

    setResolvedParams(validParams);
    setParamValues(validParams);
  }, []);

  // Update browser URL when parameters change
  useEffect(() => {
    if (widgetDef && activeTab === "parameters") {
      // Update the URL without reloading the page
      // For hash-based routing, append query params to the existing route hash
      const urlParams = new URLSearchParams();
      urlParams.set("widgetId", getWidgetId(widgetDef));
      urlParams.set("params", JSON.stringify(resolvedParams));

      // Get current hash route (e.g., "/app" from "#/app")
      const currentHash = window.location.hash;
      const routeMatch = currentHash.match(/^#(\/.*?)(?:\?|$)/);
      const currentRoute = routeMatch ? routeMatch[1] : "/";

      // Append query params to existing route hash
      const newUrl = `${window.location.pathname}#${currentRoute}?${urlParams.toString()}`;
      window.history.replaceState(
        { params: resolvedParams, widgetId: getWidgetId(widgetDef) },
        "",
        newUrl,
      );
    }
  }, [widgetDef, resolvedParams, activeTab]);

  // Handle back/forward navigation
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      if (
        event.state &&
        event.state.params &&
        event.state.widgetId &&
        widgetDef &&
        getWidgetId(widgetDef) === event.state.widgetId
      ) {
        setResolvedParams(event.state.params);
        setParamValues(event.state.params);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [widgetDef]);

  // Render widget preview
  const renderWidgetPreview = () => {
    if (!widgetDef) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] text-gray-500 dark:text-gray-400">
          <p className="mb-2">No widget definition loaded</p>
          <p className="text-sm">
            Load a widget definition in Debug mode first
          </p>
        </div>
      );
    }

    // Prevent infinite recursion: DebugWidget cannot preview itself
    if (widgetDef.type === WIDGET_TYPE_DEBUG) {
      return (
        <div className="flex flex-col items-center justify-center h-[400px] text-gray-500 dark:text-gray-400">
          <p className="mb-2">Debug Widget Preview</p>
          <p className="text-sm">
            (Self-preview disabled to prevent infinite recursion)
          </p>
        </div>
      );
    }

    const widgetType = WidgetFactory.getWidgetType(widgetDef.type);

    if (widgetType && widgetType.renderer && previewWidget) {
      const WidgetComponent = widgetType.renderer;
      return (
        <WidgetComponent
          widget={previewWidget}
          onUpdate={handlePreviewUpdate}
          onRefresh={undefined}
          mode="debug"
        />
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-[400px] text-gray-500 dark:text-gray-400">
        <p className="mb-2">
          No renderer available for widget type: {widgetDef.type}
        </p>
        <p className="text-sm">
          This widget type may not have a visual implementation yet
        </p>
      </div>
    );
  };

  // Memoized widget options for the Select component
  const widgetOptions = useMemo(() => {
    if (isLoading) {
      return []; // Empty array since Select is disabled
    }

    if (widgets.length === 0) {
      return [
        {
          label: t("debugWidget.connectDataSource") || "Connect to data source for more widgets",
          value: "no-widgets",
          disabled: true
        }
      ];
    }

    return widgets.map((w: WidgetConfig) => {
      const widgetId = getWidgetId(w);
      return {
        label: `${w.name} (${widgetId})`,
        value: widgetId,
      };
    });
  }, [widgets, isLoading, t]);

  return (
    <WidgetWrapper isLoading={false}>
      <div className="flex flex-col h-full min-h-0">
        {viewMode === "preview" ? (
          <div className="flex-1 min-h-0 overflow-auto">{renderWidgetPreview()}</div>
        ) : (
          <>
            {activeTab === "definition" && (
              <div className="p-4 space-y-4 pb-4 dark:bg-dark-800">
                <div>
                  <Label className="block mb-2 text-gray-700 dark:text-gray-200">
                    {t("debugWidget.loadByWidgetId")}
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    <Input
                      type="text"
                      value={widgetIdInput}
                      onChange={(value) => setWidgetIdInput(value as string)}
                      placeholder="Enter widget ID (e.g. portfolio/stocks)"
                      aria-label="Enter widget ID"
                    />
                    <Select
                      value={widgetIdInput}
                      onChange={(value) => setWidgetIdInput(value as string)}
                      options={widgetOptions}
                      disabled={isLoading || widgets.length === 0}
                      aria-label="Select widget"
                      placeholder={t("debugWidget.selectWidget") || "Select Widget"}
                      className="dark:bg-dark-800 dark:text-grey-50"
                      theme={"dark"}
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={loadWidgetById}
                      disabled={isLoading}
                      aria-label="Load widget"
                      className="w-full whitespace-nowrap sm:col-span-2 lg:col-span-1"
                      data-loading={isLoading}
                    >
                      {isLoading
                        ? t("debugWidget.loading")
                        : t("debugWidget.load")}
                    </Button>
                  </div>
                  {loadError && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-600 dark:text-red-400">
                      {loadError}
                    </div>
                  )}
                </div>

                <div>
                  <Label className="block mb-2 text-gray-700 dark:text-gray-200">
                    {t("debugWidget.widgetDefinitionJson")}
                  </Label>
                  <Textarea
                    className="w-full h-48 font-mono"
                    value={jsonInput}
                    onChange={(value) => setJsonInput(value as string)}
                    placeholder="Paste widget definition JSON here..."
                    aria-label={t("debugWidget.widgetDefinitionJson")}
                  />
                  {jsonError && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-600 dark:text-red-400">
                      {jsonError}
                    </div>
                  )}
                  {validationErrors.length > 0 && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-600 dark:text-red-400">
                      {validationErrors.map((err, i) => (
                        <div key={i}>{err}</div>
                      ))}
                    </div>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleApplyDefinition}
                    aria-label={t("debugWidget.applyDefinition")}
                    className="mt-2"
                  >
                    {t("debugWidget.applyDefinition")}
                  </Button>
                </div>

                {widgetDef && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                    <div className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                      {t("debugWidget.loaded")}:{" "}
                      {getWidgetId(widgetDef) || t("debugWidget.unnamed")}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-blue-600 dark:text-blue-400">
                          {t("debugWidget.type")}:
                        </span>
                        <span className="text-blue-900 dark:text-blue-200 ml-2 font-mono">
                          {widgetDef.type}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600 dark:text-blue-400">
                          {t("debugWidget.endpoint")}:
                        </span>
                        <span className="text-blue-900 dark:text-blue-200 ml-2 truncate max-w-32 font-mono">
                          {widgetDef.endpoint}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600 dark:text-blue-400">
                          {t("debugWidget.category")}:
                        </span>
                        <span className="text-blue-900 dark:text-blue-200 ml-2">
                          {widgetDef.category || "-"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-600 dark:text-blue-400">
                          {t("debugWidget.params")}:
                        </span>
                        <span className="text-blue-900 dark:text-blue-200 ml-2 font-mono">
                          {((widgetDef.params || (widgetDef.data as Record<string, unknown>)?.params) || []).length}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "parameters" && (
              <div className="p-4 dark:bg-dark-800">
                {!widgetDef ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    {t("debugWidget.noWidgetDefinition")}
                  </div>
                ) : (
                  <div>
                    <Label className="block mb-3 text-gray-700 dark:text-gray-200">
                      {t("debugWidget.composedUrl")}
                    </Label>
                    <div className="mb-4">
                      <div className="bg-gray-50 dark:bg-dark-600 rounded-md p-3 border border-gray-200 dark:border-dark-400">
                        <div className="text-sm font-mono text-gray-900 dark:text-gray-50 break-all select-all">
                          {getComposedUrl}
                        </div>
                      </div>
                    </div>

                    <Label className="block mb-3 text-gray-700 dark:text-gray-200">
                      {t("debugWidget.inputParameters")}
                    </Label>
                    <div className="space-y-3 mb-4">
                      {((widgetDef.params || (widgetDef.data as Record<string, unknown>)?.params) || []).map((p, i) => {
                        const pRec = p as unknown as ParamRecord;
                        const paramName = getParamName(p);
                        const paramType = p.type;
                        const currentValue =
                          paramValues[paramName] ??
                          pRec.value ??
                          p.default ??
                          "";

                        return (
                          <div
                            key={i}
                            className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-dark-600"
                          >
                            <div className="flex-1 mr-4">
                              <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                {p.label || paramName}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {paramType}
                              </div>
                              {typeof p.description === "string" && (
                                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                  {p.description}
                                </div>
                              )}
                            </div>
                            <div className="w-40">
                              <ParameterInput
                                paramName={paramName}
                                label={(p.label as string) || paramName}
                                type={paramType as WidgetParameterType}
                                value={currentValue}
                                onChange={(name, value) =>
                                  handleParamChange(name, value)
                                }
                                options={
                                  p.options as
                                    | Array<{ value: unknown; label: string }>
                                    | undefined
                                }
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleFetchData}
                      disabled={fetchLoading}
                      aria-label={t("debugWidget.fetchData")}
                      className="whitespace-nowrap"
                      data-loading={fetchLoading}
                    >
                      {fetchLoading
                        ? t("debugWidget.fetching")
                        : t("debugWidget.fetchData")}
                    </Button>

                    <div className="mt-4">
                      <Label className="block mb-2 text-gray-700 dark:text-gray-200">Response Data</Label>
                      <Textarea
                        className="w-full h-64 font-mono overflow-auto border border-gray-200 dark:border-dark-400 rounded-md"
                        value={responseData}
                        readOnly
                        aria-label="Response Data"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </WidgetWrapper>
  );
}

export default React.memo(DebugWidget);
