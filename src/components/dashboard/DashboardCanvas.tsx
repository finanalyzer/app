import { Button, Icon } from "@openbb/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Layout, LayoutItem } from "react-grid-layout";
import { ResponsiveGridLayout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { useTranslation } from "react-i18next";

import {
  addWidget as addWidgetApi,
  deleteWidget as deleteWidgetApi,
  getDashboard,
  getDashboards,
  updateDashboard,
  updateWidget as updateWidgetApi,
  type Dashboard as ApiDashboard,
  type Widget as ApiWidget,
} from "../../services/dashboardApi";
import { setActiveDashboardId } from "../../services/dashboardSession";
import { widgetService } from "../../services/widgets/widgetService";
import type { WidgetConfig, WidgetParameterType, Group } from "../../types/widgets";
import {
  ChartWidget,
  DebugWidget,
  HtmlWidget,
  MarkdownWidget,
  MetricWidget,
  TableWidget,
  TableSettingsModal,
  WidgetMenuModal,
} from "../widgets";
import type { TableSettings } from "../widgets/TableSettingsModal";
import { NavigationBar } from "../widgets/NavigationBar";
import "./DashboardCanvas.css";
import { ParameterInput } from "./ParameterInput";

interface DashboardCanvasProps {
  dashboardId?: string;
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

interface Widget {
  id: string;
  type: string;
  title: string;
  position: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
  data?: any;
}

function apiWidgetToWidget(api: ApiWidget): Widget {
  const pos = api.position as Record<string, number> | undefined;
  return {
    id: api.id,
    type: api.type,
    title: api.title,
    position: {
      x: pos?.x ?? 0,
      y: pos?.y ?? 0,
      w: pos?.w ?? 2,
      h: pos?.h ?? 2,
    },
    data: api.data,
  };
}

function widgetToApi(widget: Widget): ApiWidget {
  return {
    id: widget.id,
    type: widget.type,
    title: widget.title,
    position: widget.position,
    data: widget.data,
  };
}

function findWidgetDefinition(
  widgetId: string,
  definitions: WidgetConfig[],
  widgetData?: Record<string, unknown>,
): WidgetConfig | undefined {
  const standardMatch = definitions.find(
    (def) =>
      def.id === widgetId ||
      def.id === `built-in-${widgetId}` ||
      widgetId.startsWith(`${def.id}-`),
  );

  if (standardMatch) return standardMatch;

  if (widgetData && typeof widgetData.widgetId === 'string') {
    const dataWidgetId = widgetData.widgetId as string;
    return definitions.find(
      (def) =>
        def.id === dataWidgetId ||
        def.id === `built-in-${dataWidgetId}` ||
        dataWidgetId.startsWith(`${def.id}-`),
    );
  }

  return undefined;
}

export function DashboardCanvas({ dashboardId: propId, activeTab: propActiveTab, onTabChange }: DashboardCanvasProps) {
  const { t } = useTranslation();
  const [activeId, setActiveId] = useState<string>(propId || "");
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [layout, setLayout] = useState<LayoutItem[]>([]);

  // Extract unique tabs from widgets
  const tabs = widgets.reduce((acc, widget) => {
    const tabId = widget.data?.tabId as string;
    const tabName = widget.data?.tabName as string;
    if (tabId && tabName && !acc.find(t => t.id === tabId)) {
      acc.push({ id: tabId, name: tabName });
    }
    return acc;
  }, [] as Array<{ id: string; name: string }>);

  // Determine active tab (use prop if provided, otherwise first tab)
  const activeTab = propActiveTab || (tabs.length > 0 ? tabs[0].id : "");

  // Filter widgets based on active tab (with deduplication by widget.id)
  const filteredWidgets = useMemo(() => {
    const base = tabs.length > 0 
      ? widgets.filter(widget => widget.data?.tabId === activeTab)
      : widgets;
    
    // Deduplicate by widget.id, keeping the first occurrence
    const seen = new Set<string>();
    return base.filter(widget => {
      if (!widget.id || seen.has(widget.id)) return false;
      seen.add(widget.id);
      return true;
    });
  }, [widgets, tabs, activeTab]);

  // Filter layout based on active tab (with deduplication by item.i)
  const filteredLayout = useMemo(() => {
    const baseLayout = tabs.length > 0
      ? layout.filter(item => {
          const widget = widgets.find(w => w.id === item.i);
          return widget?.data?.tabId === activeTab;
        })
      : layout;
    
    // Deduplicate by item.i, keeping the first occurrence
    const seen = new Set<string>();
    return baseLayout.filter(item => {
      if (!item.i || seen.has(item.i)) return false;
      seen.add(item.i);
      return true;
    });
  }, [layout, widgets, tabs, activeTab]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gridWidth, setGridWidth] = useState(1200);
  const [openMenuWidgetId, setOpenMenuWidgetId] = useState<string | null>(null);
  const [widgetDebugModes, setWidgetDebugModes] = useState<
    Record<string, boolean>
  >({});
  const [widgetViewModes, setWidgetViewModes] = useState<
    Record<string, { viewMode: string; activeTab: string }>
  >({});
  const [widgetParameters, setWidgetParameters] = useState<
    Record<string, { params: any[]; values: Record<string, unknown> }>
  >({});
  const [widgetDefinitions, setWidgetDefinitions] = useState<WidgetConfig[]>(
    [],
  );
  const [_widgetData, setWidgetData] = useState<Record<string, unknown>>({});
  const [_widgetLoading, setWidgetLoading] = useState<Record<string, boolean>>(
    {},
  );
  const [widgetErrors, setWidgetErrors] = useState<Record<string, string>>({});
  const [_refreshKey, setRefreshKey] = useState<Record<string, number>>({});
  const [isWidgetMenuOpen, setIsWidgetMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customWidgets, setCustomWidgets] = useState<WidgetConfig[]>([]);
  const [groupConfigs, setGroupConfigs] = useState<Group[]>([]);
  const [tableSettings, setTableSettings] = useState<Record<string, TableSettings>>({});
  const [openTableSettingsWidgetId, setOpenTableSettingsWidgetId] = useState<string | null>(null);

  useEffect(() => {
    if (propId && propId !== activeId) {
      setActiveId(propId);
    }
  }, [propId]);

  useEffect(() => {
    const loadWidgetDefinitions = async () => {
      try {
        const definitions = await widgetService.getWidgets();
        setWidgetDefinitions(definitions);
      } catch (e) {
        console.error("Failed to load widget definitions:", e);
      }
    };
    loadWidgetDefinitions();
  }, []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (activeId) {
          const dashboard = await fetchDashboard(activeId);
          if (dashboard) {
            const w = (dashboard.widgets || []).map(apiWidgetToWidget);
            setWidgets(w);
            const rawLayout = w.map((widget) => ({
              i: widget.id,
              x: widget.position.x,
              y: widget.position.y,
              w: widget.position.w,
              h: widget.position.h,
            }));
            setLayout(rawLayout);
            // 初始化tableSettings
            const initialTableSettings: Record<string, TableSettings> = {};
            w.forEach(widget => {
              const savedConfig = (widget.data as Record<string, unknown>)?.tableConfig as Record<string, unknown> | undefined;
              if (savedConfig) {
                initialTableSettings[widget.id] = {
                  decimalPlaces: savedConfig.decimalPlaces as number || 2,
                  visibleColumns: (savedConfig.visibleColumns as string[]) || [],
                };
              }
            });
            setTableSettings(initialTableSettings);
          } else {
            setError("Dashboard not found");
          }
        } else {
          const dashboardList = await getDashboards().catch(() => []);
          if (dashboardList.length > 0) {
            const first = dashboardList[0];
            setActiveId(first.id);
            setActiveDashboardId(first.id);
            const w = (first.widgets || []).map(apiWidgetToWidget);
            setWidgets(w);
            const rawLayout = w.map((widget) => ({
              i: widget.id,
              x: widget.position.x,
              y: widget.position.y,
              w: widget.position.w,
              h: widget.position.h,
            }));
            setLayout(rawLayout);
            // 初始化tableSettings
            const initialTableSettings: Record<string, TableSettings> = {};
            w.forEach(widget => {
              const savedConfig = (widget.data as Record<string, unknown>)?.tableConfig as Record<string, unknown> | undefined;
              if (savedConfig) {
                initialTableSettings[widget.id] = {
                  decimalPlaces: savedConfig.decimalPlaces as number || 2,
                  visibleColumns: (savedConfig.visibleColumns as string[]) || [],
                };
              }
            });
            setTableSettings(initialTableSettings);
          }
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [activeId]);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setGridWidth(containerRef.current.clientWidth);
      }
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    const handleClickOutside = () => {
      setOpenMenuWidgetId(null);
    };

    if (openMenuWidgetId) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => document.removeEventListener("click", handleClickOutside);
  }, [openMenuWidgetId]);

  useEffect(() => {
    const widgetsWithGroups = widgets.filter(w => w.data?.groups && Array.isArray(w.data.groups));
    if (widgetsWithGroups.length > 0) {
      const groups = widgetsWithGroups[0].data.groups as Group[];
      setGroupConfigs(groups);
    }
  }, [widgets]);

  async function fetchDashboard(id: string): Promise<ApiDashboard | null> {
    try {
      const dashboard = await getDashboard(id);
      return dashboard;
    } catch {
      return null;
    }
  }

  function debouncedSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveLayout();
    }, 500);
  }

  const updateWidgetParameterWithGrouping = useCallback((
    widgetId: string,
    paramName: string,
    value: unknown
  ) => {
    setWidgetParameters(prev => {
      const newParams = { ...prev };

      if (newParams[widgetId]) {
        newParams[widgetId] = {
          ...newParams[widgetId],
          values: {
            ...newParams[widgetId].values,
            [paramName]: value
          }
        };
      }

      const group = groupConfigs.find(g => g.paramName === paramName);

      if (group) {
        group.widgetIds.forEach((targetWidgetId: string) => {
          const matchingWidget = widgets.find(w =>
            w.id === targetWidgetId ||
            w.id.startsWith(`${targetWidgetId}-`) ||
            (w.data as Record<string, unknown>)?.widgetId === targetWidgetId
          );

          if (matchingWidget && matchingWidget.id !== widgetId) {
            if (newParams[matchingWidget.id]) {
              newParams[matchingWidget.id] = {
                ...newParams[matchingWidget.id],
                values: {
                  ...newParams[matchingWidget.id].values,
                  [paramName]: value
                }
              };
            }
          }
        });
      }

      return newParams;
    });
  }, [widgets, groupConfigs]);

  async function saveLayout() {
    if (!activeId || widgets.length === 0) return;
    try {
      await updateDashboard(activeId, {
        widgets: widgets.map(widgetToApi),
      });
    } catch {
      // Auto-save failed, will retry on next layout change
    }
  }

  const getComposedUrl = useCallback(
    (widgetDef: WidgetConfig, params: Record<string, unknown>) => {
      if (!widgetDef.endpoint) return "";

      // Check if endpoint is a full URL (starts with http:// or https://)
      const isFullUrl = widgetDef.endpoint.startsWith('http://') || widgetDef.endpoint.startsWith('https://');
      
      let url: string;
      
      if (isFullUrl) {
        // If endpoint is a full URL, use it directly without connectionUrl
        url = widgetDef.endpoint;
      } else {
        // Normalize connectionUrl: remove trailing slash
        const connectionUrl = widgetDef.connectionUrl || "";
        const normalizedBaseUrl = connectionUrl.endsWith('/')
          ? connectionUrl.slice(0, -1)
          : connectionUrl;
        
        // Ensure endpoint starts with /
        const normalizedEndpoint = widgetDef.endpoint.startsWith('/')
          ? widgetDef.endpoint
          : `/${widgetDef.endpoint}`;
        
        url = `${normalizedBaseUrl}${normalizedEndpoint}`;
      }

      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          queryParams.append(key, String(value));
        }
      });

      return queryParams.toString() ? `${url}?${queryParams.toString()}` : url;
    },
    [],
  );

  const fetchWidgetData = useCallback(
    async (widgetId: string) => {
      const allDefinitions = [...widgetDefinitions, ...customWidgets];
      let widgetDef = findWidgetDefinition(widgetId, allDefinitions);

      // If no definition found in widgetDefinitions/customWidgets, check the widget's own data
      // This handles widgets added directly without going through the upload flow
      if (!widgetDef) {
        const widget = widgets.find(w => w.id === widgetId);
        if (widget && widget.data && typeof widget.data === 'object') {
          widgetDef = widget.data as WidgetConfig;
        }
      }

      if (!widgetDef || !widgetDef.endpoint) {
        return;
      }

      // 获取当前参数值，如果没有则使用默认值
      let params = widgetParameters[widgetId]?.values || {};
      
      // 确保所有参数都有默认值
      if (widgetDef.params && widgetDef.params.length > 0) {
        const defaultParams: Record<string, unknown> = {};
        widgetDef.params.forEach((param) => {
          const paramName = (param as unknown as { paramName?: string }).paramName || param.name;
          if (!paramName) return;
          
          // 优先级：当前值 > param.default > param.value
          if (params[paramName] !== undefined) {
            defaultParams[paramName] = params[paramName];
          } else if (param.default !== undefined) {
            defaultParams[paramName] = param.default;
          } else if ((param as unknown as { value?: unknown }).value !== undefined) {
            defaultParams[paramName] = (param as unknown as { value?: unknown }).value;
          }
        });
        params = defaultParams;
      }
      
      const fullUrl = getComposedUrl(widgetDef, params);

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

      setWidgetLoading((prev) => ({ ...prev, [widgetId]: true }));
      setWidgetErrors((prev) => ({ ...prev, [widgetId]: "" }));

      try {
        const response = await fetch(finalUrl, { headers });

        if (!response.ok) {
          await response.text().catch(() => "");
          const errorMessage = `Error ${response.status}: ${response.statusText}`;
          setWidgetErrors((prev) => ({
            ...prev,
            [widgetId]: errorMessage,
          }));
          return;
        }

        const contentType = response.headers.get("content-type") || "";
        let data: unknown;
        
        if (contentType.includes("application/json")) {
          data = await response.json();
        } else if (contentType.includes("text/html")) {
          const htmlContent = await response.text();
          data = { content: htmlContent, type: "html" };
        } else {
          data = await response.text();
        }

        setWidgetData((prev) => ({ ...prev, [widgetId]: data }));
        setWidgetErrors((prev) => ({ ...prev, [widgetId]: "" }));
      } catch (e) {
        const errorMessage = e instanceof Error ? e.message : "Unknown error";
        setWidgetErrors((prev) => ({ ...prev, [widgetId]: errorMessage }));
      } finally {
        setWidgetLoading((prev) => ({ ...prev, [widgetId]: false }));
      }
    },
    [widgetDefinitions, customWidgets, widgetParameters, getComposedUrl, widgets],
  );

  const handleRefreshWidget = useCallback(
    (widgetId: string) => {
      setRefreshKey((prev) => ({
        ...prev,
        [widgetId]: (prev[widgetId] || 0) + 1,
      }));

      fetchWidgetData(widgetId);
    },
    [fetchWidgetData],
  );

  const handleLayoutChange = useCallback(
    (newLayout: Layout, _layouts: any) => {
      const layoutItems = (newLayout as LayoutItem[]).filter((item) => item.i);
      setLayout((prevLayout) => {
        const newLayoutMap = new Map(layoutItems.map((item) => [item.i, item]));
        return prevLayout.map((item) => newLayoutMap.get(item.i) || item);
      });
      setWidgets(
        widgets.map((widget) => {
          const item = layoutItems.find((l) => l.i === widget.id);
          if (item) {
            return {
              ...widget,
              position: {
                x: item.x ?? 0,
                y: item.y ?? 0,
                w: item.w ?? 2,
                h: item.h ?? 2,
              },
            };
          }
          return widget;
        }),
      );
      debouncedSave();
    },
    [widgets],
  );

  const handleAddWidget = () => {
    setIsWidgetMenuOpen(true);
  };

  const handleBrowseFiles = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);

      let widgetsToAdd: WidgetConfig[] = [];

      if (Array.isArray(json)) {
        widgetsToAdd = json;
      } else if (typeof json === "object" && json !== null) {
        // Check if it's a single widget (has id and name at top level)
        if (json.id && json.name) {
          widgetsToAdd = [json as WidgetConfig];
        } else {
          // Otherwise treat as object with widget configs as values
          Object.values(json).forEach((value) => {
            if (typeof value === "object" && value !== null && (value as WidgetConfig).id && (value as WidgetConfig).name) {
              widgetsToAdd.push(value as WidgetConfig);
            }
          });
        }
      }

      if (widgetsToAdd.length > 0) {
        // Generate unique IDs for custom widgets
        const widgetsWithUniqueIds = widgetsToAdd.map((widget) => ({
          ...widget,
          id: widget.id || `${widget.name.toLowerCase().replace(/\s+/g, "-")}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        }));
        setCustomWidgets((prev) => [...prev, ...widgetsWithUniqueIds]);
      }
    } catch (e) {
      console.error("Failed to parse widget file:", e);
    }

    event.target.value = "";
  };

  const handleAddWidgetsFromMenu = async (selectedWidgets: WidgetConfig[]) => {
    if (!activeId) return;
    for (const widgetConfig of selectedWidgets) {
      const newWidget: Widget = {
        id: `${widgetConfig.id}-${Date.now()}`,
        type: widgetConfig.type || "metric",
        title: widgetConfig.name,
        position: { x: 0, y: 0, w: widgetConfig.gridData?.w || 2, h: widgetConfig.gridData?.h || 2 },
        data: widgetConfig,
      };
      try {
        await addWidgetApi(activeId, widgetToApi(newWidget));
        setWidgets((prev) => [...prev, newWidget]);
        setLayout((prev) => [
          ...prev,
          {
            i: newWidget.id,
            x: newWidget.position.x,
            y: newWidget.position.y,
            w: newWidget.position.w,
            h: newWidget.position.h,
          },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to add widget");
      }
    }
  };

  const handleDeleteWidget = async (widgetId: string) => {
    if (!activeId) return;
    try {
      await deleteWidgetApi(activeId, widgetId);
      setWidgets(widgets.filter((w) => w.id !== widgetId));
      setLayout(layout.filter((item) => item.i !== widgetId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete widget");
    }
  };

  if (loading) {
    return (
      <div className="dashboard-canvas flex flex-col h-full">
        <div className="dashboard-loading">
          {t("common.loading") || "Loading..."}
        </div>
      </div>
    );
  }

  if (error && filteredWidgets.length === 0) {
    return (
      <div className="dashboard-canvas flex flex-col h-full">
        <div className="dashboard-error">
          <p className="dashboard-error-text">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-canvas flex flex-col h-full">
      {tabs.length > 0 && (
        <NavigationBar
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
        />
      )}
      <div className="dashboard-grid-container flex-1" ref={containerRef}>
        {filteredWidgets.length === 0 ? (
          <div className="dashboard-empty-state">
            <div className="dashboard-empty-grid">
              <div className="dashboard-empty-card">
                <div className="dashboard-empty-icon-wrapper">
                  <svg
                    className="dashboard-empty-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18" />
                    <path d="M9 21V9" />
                  </svg>
                </div>
                <p className="dashboard-empty-title">
                  {t("dashboardEmpty.addWidgets")}
                </p>
                <p className="dashboard-empty-description">
                  {t("dashboardEmpty.addWidgetsDescription")}
                </p>
                <Button variant="primary" size="sm" onClick={handleAddWidget}>
                  {t("dashboardEmpty.addWidgets")}
                </Button>
              </div>
              <div className="dashboard-empty-card">
                <div className="dashboard-empty-icon-wrapper">
                  <svg
                    className="dashboard-empty-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                </div>
                <p className="dashboard-empty-title">
                  {t("dashboardEmpty.browseApps")}
                </p>
                <p className="dashboard-empty-description">
                  {t("dashboardEmpty.browseAppsDescription")}
                </p>
                <Button variant="outlined" size="sm">
                  {t("dashboardEmpty.browseApps")}
                </Button>
              </div>
              <div className="dashboard-empty-file-card">
                <p className="dashboard-empty-file-title">
                  {t("dashboardEmpty.addYourFiles")}
                </p>
                <p className="dashboard-empty-file-description">
                  {t("dashboardEmpty.supportedFormats")}
                </p>
                <div className="dashboard-empty-file-upload">
                  <svg
                    className="dashboard-empty-file-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  <p className="dashboard-empty-file-text">
                    <span>{t("dashboardEmpty.dragAndDrop")}</span>{" "}
                    {t("dashboardEmpty.dragAndDropDescription")}
                  </p>
                  <p className="dashboard-empty-file-or">
                    {t("dashboardEmpty.or")}
                  </p>
                  <Button variant="secondary" size="sm" onClick={handleBrowseFiles}>
                    {t("dashboardEmpty.browseFiles")}
                  </Button>
                  <p className="dashboard-empty-file-size">
                    {t("dashboardEmpty.fileSizeLimit")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <ResponsiveGridLayout
            className="dashboard-grid"
            layouts={{
              lg: filteredLayout,
              md: filteredLayout,
              sm: filteredLayout,
              xs: filteredLayout,
              xxs: filteredLayout,
            }}
            breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 }}
            cols={{ lg: 40, md: 40, sm: 20, xs: 10, xxs: 5 }}
            rowHeight={35}
            width={gridWidth}
            margin={[16, 16]}
            containerPadding={[16, 16]}
            onLayoutChange={handleLayoutChange}
          >
            {filteredWidgets.map((widget) => {
              const widgetParamData = widgetParameters[widget.id];
              const hasParameters = widgetParamData?.params?.length > 0;

              return (
                <div key={widget.id} className="dashboard-widget group">
                  <div className="widget-header absolute top-0 left-0 right-0 z-10 bg-white dark:bg-dark-900 border-b border-gray-200 dark:border-dark-700 px-4 py-2 flex items-center justify-between">
                    <div className="widget-header-left">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {widget.title}
                      </span>
                    </div>
                    {hasParameters && (
                      <div className="widget-header-center flex flex-wrap gap-4 flex-1 mx-4">
                        {widgetParamData.params.map((param, index) => {
                          const paramRecord = param as unknown as Record<
                            string,
                            unknown
                          >;
                          const paramName =
                            (paramRecord.paramName as string) || param.name;
                          const paramType =
                            (paramRecord.type as string) || "string";
                          const paramOptions = paramRecord.options as
                            | Array<{ value: unknown; label: string }>
                            | undefined;

                          return (
                            <ParameterInput
                              key={`${paramName}-${index}`}
                              paramName={paramName}
                              label={(param.label as string) || paramName}
                              type={paramType as WidgetParameterType}
                              value={widgetParamData.values[paramName]}
                              onChange={(name, value) => {
                                setWidgetParameters((prev) => ({
                                  ...prev,
                                  [widget.id]: {
                                    ...prev[widget.id],
                                    values: {
                                      ...prev[widget.id].values,
                                      [name]: value,
                                    },
                                  },
                                }));
                              }}
                              options={paramOptions}
                              parameter={param as any}
                              onFormSubmit={() => handleRefreshWidget(widget.id)}
                              connectionUrl={(() => {
                                const allDefs = [...widgetDefinitions, ...customWidgets];
                                let def = findWidgetDefinition(widget.id, allDefs);
                                if (!def && widget.data && typeof widget.data === 'object') {
                                  def = widget.data as any;
                                }
                                return def?.connectionUrl;
                              })()}
                            />
                          );
                        })}
                      </div>
                    )}
                    <div className="widget-header-right">
                      <Button variant="ghost" size="sm" onClick={() => handleRefreshWidget(widget.id)} title={t("common.refresh")}>
                        <Icon name={"refresh-right" as never} size={16} />
                      </Button>
                      <div className="relative">
                        <Button variant="ghost" size="sm" onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuWidgetId(
                            openMenuWidgetId === widget.id ? null : widget.id,
                          );
                        }} title={t("common.menu")}>
                          <Icon name={"dots-horizontal" as never} size={16} />
                        </Button>
                        {openMenuWidgetId === widget.id && (
                          <div
                            className="widget-dropdown-menu absolute right-0 top-8 w-48 rounded-md shadow-lg z-20"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="py-1">
                              <button
                                className="widget-dropdown-item block px-4 py-2 text-sm w-full text-left"
                                onClick={() => {
                                  setOpenMenuWidgetId(null);
                                  if (widget.type === "table") {
                                    setOpenTableSettingsWidgetId(widget.id);
                                  }
                                }}
                              >
                                Settings
                              </button>
                              <button
                                className="widget-dropdown-item block px-4 py-2 text-sm w-full text-left flex items-center justify-between"
                                onClick={() => {
                                  setWidgetDebugModes((prev) => ({
                                    ...prev,
                                    [widget.id]: !prev[widget.id],
                                  }));
                                }}
                              >
                                <span>Debug Mode</span>
                                <span
                                  className={`ml-2 px-2 py-0.5 rounded text-xs ${
                                    widgetDebugModes[widget.id]
                                      ? "bg-yellow-500 text-white"
                                      : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
                                  }`}
                                >
                                  {widgetDebugModes[widget.id] ? "ON" : "OFF"}
                                </span>
                              </button>
                              {widget.type === "debug" && (
                                <>
                                  <button
                                    className="widget-dropdown-item block px-4 py-2 text-sm w-full text-left"
                                    onClick={() => {
                                      setOpenMenuWidgetId(null);
                                      setWidgetViewModes((prev) => ({
                                        ...prev,
                                        [widget.id]: {
                                          viewMode: "preview",
                                          activeTab: "definition",
                                        },
                                      }));
                                    }}
                                  >
                                    Preview
                                  </button>
                                  <button
                                    className="widget-dropdown-item block px-4 py-2 text-sm w-full text-left"
                                    onClick={() => {
                                      setOpenMenuWidgetId(null);
                                      setWidgetViewModes((prev) => ({
                                        ...prev,
                                        [widget.id]: {
                                          viewMode: "debug",
                                          activeTab: "definition",
                                        },
                                      }));
                                    }}
                                  >
                                    Definition
                                  </button>
                                  <button
                                    className="widget-dropdown-item block px-4 py-2 text-sm w-full text-left"
                                    onClick={() => {
                                      setOpenMenuWidgetId(null);
                                      setWidgetViewModes((prev) => ({
                                        ...prev,
                                        [widget.id]: {
                                          viewMode: "debug",
                                          activeTab: "parameters",
                                        },
                                      }));
                                    }}
                                  >
                                    Parameters
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteWidget(widget.id)} title={t("common.delete")}>
                        <Icon name={"x" as never} size={16} />
                      </Button>
                    </div>
                  </div>
                  <div className="widget-content">
                    {widget.type === "table" && (
                      (() => {
                        const widgetDef = findWidgetDefinition(
                          (widget.data as Record<string, unknown>)?.widgetId as string || widget.id,
                          [...widgetDefinitions, ...customWidgets],
                          widget.data as Record<string, unknown>,
                        );
                        const tableConfig = widgetDef?.data as Record<string, unknown> | undefined;
                        return (
                          <TableWidget
                            widget={
                              {
                                ...widget,
                                ...widgetDef,
                                tableConfig,
                                currentParams:
                                  widgetParameters[widget.id]?.values || {},
                                instanceId: widget.id,
                                dashboardId: activeId,
                                data: widget.data,
                                error: widgetErrors[widget.id],
                              } as any
                            }
                            settings={tableSettings[widget.id]}
                            mode={widgetDebugModes[widget.id] ? "debug" : undefined}
                            onUpdate={(params: Record<string, unknown>) => {
                              Object.entries(params).forEach(([paramName, value]) => {
                                updateWidgetParameterWithGrouping(widget.id, paramName, value);
                              });
                            }}
                            onParametersChange={(params: any[], values: Record<string, unknown>) => {
                              setWidgetParameters((prev) => ({
                                ...prev,
                                [widget.id]: { params, values },
                              }));
                            }}
                            onRefresh={() => handleRefreshWidget(widget.id)}
                          />
                        );
                      })()
                    )}
                    {widget.type === "chart" && (
                      <ChartWidget
                        widget={
                          {
                            ...widget,
                            ...findWidgetDefinition(
                              (widget.data as Record<string, unknown>)?.widgetId as string || widget.id,
                              [...widgetDefinitions, ...customWidgets],
                              widget.data as Record<string, unknown>,
                            ),
                            currentParams:
                              widgetParameters[widget.id]?.values || {},
                            instanceId: widget.id,
                            dashboardId: activeId,
                            data: widget.data,
                            error: widgetErrors[widget.id],
                          } as any
                        }
                        mode={widgetDebugModes[widget.id] ? "debug" : undefined}
                        onUpdate={(params) => {
                          setWidgetParameters((prev) => ({
                            ...prev,
                            [widget.id]: {
                              ...prev[widget.id],
                              values: {
                                ...prev[widget.id]?.values,
                                ...params,
                              },
                            },
                          }));
                        }}
                        onParametersChange={(params, values) => {
                          setWidgetParameters((prev) => ({
                            ...prev,
                            [widget.id]: { params, values },
                          }));
                        }}
                        onRefresh={() => handleRefreshWidget(widget.id)}
                      />
                    )}
                    {widget.type === "metric" && (
                      <MetricWidget
                        widget={
                          {
                            ...widget,
                            ...findWidgetDefinition(
                              (widget.data as Record<string, unknown>)?.widgetId as string || widget.id,
                              [...widgetDefinitions, ...customWidgets],
                              widget.data as Record<string, unknown>,
                            ),
                            currentParams:
                              widgetParameters[widget.id]?.values || {},
                            instanceId: widget.id,
                            dashboardId: activeId,
                            data: widget.data,
                            error: widgetErrors[widget.id],
                          } as any
                        }
                        mode={widgetDebugModes[widget.id] ? "debug" : undefined}
                        onUpdate={(params) => {
                          setWidgetParameters((prev) => ({
                            ...prev,
                            [widget.id]: {
                              ...prev[widget.id],
                              values: {
                                ...prev[widget.id]?.values,
                                ...params,
                              },
                            },
                          }));
                        }}
                        onParametersChange={(params, values) => {
                          setWidgetParameters((prev) => ({
                            ...prev,
                            [widget.id]: { params, values },
                          }));
                        }}
                        onRefresh={() => handleRefreshWidget(widget.id)}
                      />
                    )}
                    {widget.type === "markdown" && (
                      <MarkdownWidget
                        widget={
                          {
                            ...widget,
                            ...findWidgetDefinition(
                              widget.id,
                              [...widgetDefinitions, ...customWidgets],
                              widget.data as Record<string, unknown>,
                            ),
                            currentParams:
                              widgetParameters[widget.id]?.values || {},
                            instanceId: widget.id,
                            dashboardId: activeId,
                            data: widget.data,
                            error: widgetErrors[widget.id],
                          } as any
                        }
                        mode={widgetDebugModes[widget.id] ? "debug" : undefined}
                        onUpdate={(params) => {
                          setWidgetParameters((prev) => ({
                            ...prev,
                            [widget.id]: {
                              ...prev[widget.id],
                              values: {
                                ...prev[widget.id]?.values,
                                ...params,
                              },
                            },
                          }));
                        }}
                        onParametersChange={(params, values) => {
                          setWidgetParameters((prev) => ({
                            ...prev,
                            [widget.id]: { params, values },
                          }));
                        }}
                        onRefresh={() => handleRefreshWidget(widget.id)}
                      />
                    )}
                    {widget.type === "html" && (
                      <HtmlWidget
                        widget={
                          {
                            ...widget,
                            ...findWidgetDefinition(
                              widget.id,
                              [...widgetDefinitions, ...customWidgets],
                              widget.data as Record<string, unknown>,
                            ),
                            currentParams:
                              widgetParameters[widget.id]?.values || {},
                            instanceId: widget.id,
                            dashboardId: activeId,
                            data: widget.data,
                            error: widgetErrors[widget.id],
                          } as any
                        }
                        mode={widgetDebugModes[widget.id] ? "debug" : undefined}
                        onUpdate={(params) => {
                          setWidgetParameters((prev) => ({
                            ...prev,
                            [widget.id]: {
                              ...prev[widget.id],
                              values: {
                                ...prev[widget.id]?.values,
                                ...params,
                              },
                            },
                          }));
                        }}
                        onParametersChange={(params, values) => {
                          setWidgetParameters((prev) => ({
                            ...prev,
                            [widget.id]: { params, values },
                          }));
                        }}
                        onRefresh={() => handleRefreshWidget(widget.id)}
                      />
                    )}
                    {widget.type === "debug" && (
                      <DebugWidget
                        widget={
                          {
                            ...widget,
                            ...findWidgetDefinition(
                              widget.id,
                              [...widgetDefinitions, ...customWidgets],
                              widget.data as Record<string, unknown>,
                            ),
                            currentParams:
                              widgetParameters[widget.id]?.values || {},
                            instanceId: widget.id,
                            dashboardId: activeId,
                            data: widget.data,
                            error: widgetErrors[widget.id],
                          } as any
                        }
                        viewMode={
                          (widgetViewModes[widget.id]?.viewMode as any) ||
                          "preview"
                        }
                        activeTab={
                          (widgetViewModes[widget.id]?.activeTab as any) ||
                          "definition"
                        }
                        onUpdate={(params) => {
                          setWidgetParameters((prev) => ({
                            ...prev,
                            [widget.id]: {
                              ...prev[widget.id],
                              values: {
                                ...prev[widget.id]?.values,
                                ...params,
                              },
                            },
                          }));
                        }}
                        onRefresh={() => handleRefreshWidget(widget.id)}
                        onParametersChange={(params, values) => {
                          setWidgetParameters((prev) => ({
                            ...prev,
                            [widget.id]: { params, values },
                          }));
                        }}
                        onWidgetUpdate={(widgetUpdateData) => {
                          // Update the widget in the widgets array
                          setWidgets((prevWidgets) =>
                            prevWidgets.map((w) =>
                              w.id === widget.id
                                ? {
                                    ...w,
                                    id: widgetUpdateData.id,
                                    data: widgetUpdateData.data
                                  }
                                : w
                            )
                          );
                          // Also update the layout to use the new widget ID
                          setLayout((prevLayout) =>
                            prevLayout.map((item) =>
                              item.i === widget.id
                                ? { ...item, i: widgetUpdateData.id }
                                : item
                            )
                          );
                        }}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </ResponsiveGridLayout>
        )}
      </div>
      <div className="dashboard-footer">
        <div className="dashboard-status">
          {filteredWidgets.length} {t("widgets.title")}
        </div>
        <Button 
          variant="primary" 
          size="sm" 
          onClick={handleAddWidget}
          className="dashboard-add-widget-btn"
          title={t("dashboardEmpty.addWidgets")}
        >
          <Icon name={"plus" as never} size={16} />
          <span className="hidden sm:inline ml-1">{t("dashboardEmpty.addWidgets")}</span>
        </Button>
      </div>
      <WidgetMenuModal
        isOpen={isWidgetMenuOpen}
        onClose={() => setIsWidgetMenuOpen(false)}
        onAddWidgets={handleAddWidgetsFromMenu}
        widgets={[...widgetDefinitions, ...customWidgets]}
        loading={!widgetDefinitions.length && !customWidgets.length}
      />
      {openTableSettingsWidgetId && (() => {
        const widget = widgets.find(w => w.id === openTableSettingsWidgetId);
        const columnDefs = (() => {
          if (!widget) return [];
          const widgetAny = widget as unknown as Record<string, unknown>;
          
          // Check path 1: widget.tableConfig.columnsDefs
          const tableConfig = widgetAny.tableConfig as Record<string, unknown> | undefined;
          if (tableConfig && tableConfig.columnsDefs) {
            const columnsDefs = tableConfig.columnsDefs as Array<{ field: string; headerName?: string }>;
            if (columnsDefs && Array.isArray(columnsDefs) && columnsDefs.length > 0) {
              return columnsDefs;
            }
          }
          
          // Check path 2: widget.data.data.table.columnsDefs
          const widgetData = widgetAny.data as Record<string, unknown> | undefined;
          if (widgetData) {
            const tableDataObj = widgetData.data as Record<string, unknown> | undefined;
            if (tableDataObj) {
              const table = tableDataObj.table as Record<string, unknown> | undefined;
              if (table && table.columnsDefs) {
                const columnsDefs = table.columnsDefs as Array<{ field: string; headerName?: string }>;
                if (columnsDefs && Array.isArray(columnsDefs) && columnsDefs.length > 0) {
                  return columnsDefs;
                }
              }
            }
            
            // Check path 3: widget.data.columnsDefs
            if (widgetData.columnsDefs) {
              const columnsDefs = widgetData.columnsDefs as Array<{ field: string; headerName?: string }>;
              if (columnsDefs && Array.isArray(columnsDefs) && columnsDefs.length > 0) {
                return columnsDefs;
              }
            }
          }
          
          return [];
        })();
        // 从widget.data中读取已保存的配置
        const savedConfig = (widget?.data as Record<string, unknown>)?.tableConfig as Record<string, unknown> | undefined;
        const availableCols = columnDefs.map(c => c.field);
        const currentSettings: TableSettings = {
          decimalPlaces: savedConfig?.decimalPlaces as number || tableSettings[openTableSettingsWidgetId]?.decimalPlaces || 2,
          visibleColumns: (savedConfig?.visibleColumns as string[]) || tableSettings[openTableSettingsWidgetId]?.visibleColumns || availableCols,
        };
        return (
          <TableSettingsModal
            isOpen={!!openTableSettingsWidgetId}
            onClose={() => setOpenTableSettingsWidgetId(null)}
            onSave={(settings) => {
              // 更新前端状态
              setTableSettings((prev) => ({
                ...prev,
                [openTableSettingsWidgetId!]: settings,
              }));
              // 调用API保存到后端
              if (activeId && widget) {
                const updatedData = {
                  ...widget.data,
                  tableConfig: settings,
                };
                updateWidgetApi(activeId, widget.id, { data: updatedData });
              }
              // 刷新widget以应用新设置
              handleRefreshWidget(openTableSettingsWidgetId!);
            }}
            currentSettings={currentSettings}
            columnDefs={columnDefs}
          />
        );
      })()}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFileChange}
        style={{ display: "none" }}
      />
    </div>
  );
}
