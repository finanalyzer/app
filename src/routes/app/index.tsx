import { Button, Icon, Input } from "@openbb/ui";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { connectionService } from "../../services/connections/connectionService";
import { addWidget, createDashboard, type Widget } from "../../services/dashboardApi";
import { widgetService } from "../../services/widgets/widgetService";
import { cn } from "../../utils/cn";
import { generateUUID } from "../../utils/uuid";

interface ApplicationCardProps {
  name: string;
  img: string;
  imgDark?: string;
  imgLight?: string;
  description: string;
  connectionName: string;
  widgetCount?: number;
  connectionId: string;
  onClick?: () => void;
  onRefresh?: (connectionId: string) => void;
}

function ApplicationCard({
  name,
  img,
  description,
  connectionName,
  widgetCount,
  connectionId,
  onClick,
  onRefresh,
}: ApplicationCardProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "bg-white dark:bg-dark-900 rounded-lg shadow-md p-4 hover:shadow-lg transition-all duration-200 cursor-pointer",
        "flex flex-col",
      )}
      onClick={onClick}
    >
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
        {connectionName}
      </div>
      <div className="mb-4">
        <img
          src={img}
          alt={name}
          className="w-full h-32 object-cover rounded-md"
        />
      </div>
      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
        {name}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
        {description}
      </p>
      <div className="mt-auto flex justify-between items-center">
        {widgetCount !== undefined && (
          <div className="text-sm text-gray-600 dark:text-gray-300">
            {t("apps.widgetCount", { count: widgetCount })}
          </div>
        )}
        {onRefresh && (
          <Button
            variant="ghost"
            size="sm"
            icon
            onClick={(e) => {
              e.stopPropagation();
              onRefresh(connectionId);
            }}
            title={t("common.refresh")}
            className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <Icon name={"refresh-right" as never} size={16} />
          </Button>
        )}
      </div>
    </div>
  );
}

interface ChartView {
  enabled: boolean;
  chartType: string;
}

interface ColumnOrder {
  orderedColIds: string[];
}

interface ColumnState {
  default: {
    columnOrder: ColumnOrder;
    columnPinning?: {
      leftColIds: string[];
      rightColIds: string[];
    };
  };
}

interface State {
  chartView?: ChartView;
  columnState?: ColumnState;
  params?: Record<string, string>;
}

interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  state?: State;
}

interface Tab {
  id: string;
  name: string;
  layout: LayoutItem[];
}

interface Group {
  name: string;
  type: string;
  paramName: string;
  defaultValue: string;
  widgetIds: string[];
}

interface AppItem {
  name: string;
  img: string;
  img_dark?: string;
  img_light?: string;
  description: string;
  tabs?: Record<string, Tab>;
  groups?: Group[];
  connectionId: string;
  connectionName: string;
  widgetCount?: number;
}

function calculateWidgetCount(app: unknown): number {
  let count = 0;
  const appRecord = app as Record<string, unknown>;
  if (appRecord.tabs && typeof appRecord.tabs === "object") {
    Object.values(appRecord.tabs as Record<string, unknown>).forEach(
      (tab: unknown) => {
        const tabRecord = tab as Record<string, unknown>;
        if (tabRecord.layout && Array.isArray(tabRecord.layout)) {
          count += tabRecord.layout.length;
        }
      },
    );
  }
  return count;
}

class AppService {
  private apps: AppItem[] = [];
  private lastFetchTime = 0;
  private cacheDuration = 30000;
  private fetchPromise: Promise<AppItem[]> | null = null;

  async getApps(signal?: AbortSignal, forceRefresh = false): Promise<AppItem[]> {
    const now = Date.now();

    if (this.fetchPromise && !forceRefresh) {
      return this.fetchPromise;
    }

    if (!forceRefresh && now - this.lastFetchTime < this.cacheDuration && this.apps.length > 0) {
      return this.apps;
    }

    const fetchApps = async (): Promise<AppItem[]> => {
      const isDebugMode = import.meta.env.VITE_DEBUG_MODE === "true";
      
      const debugLog = (level: "info" | "success" | "error" | "warn", message: string, data?: unknown) => {
        if (!isDebugMode) return;
        const timestamp = new Date().toISOString();
        console.log(`%c[${timestamp}] [APP_SERVICE] [${level.toUpperCase()}] ${message}`, 
          level === "error" ? "color: #EF4444" : level === "success" ? "color: #10B981" : level === "warn" ? "color: #F59E0B" : "color: #3B82F6", 
          data);
      };

      debugLog("info", "Starting fetchApps execution");
      
      try {
        const connections = connectionService.getConnections();
        const activeConnections = connections.filter(
          (conn) => conn.status === "connected",
        );
        
        debugLog("info", `Found ${connections.length} total connections, ${activeConnections.length} active connections`, {
          totalConnections: connections.length,
          activeConnections: activeConnections.length,
          connectionDetails: connections.map(c => ({ id: c.id, name: c.name, status: c.status, url: c.url }))
        });

        const apps: AppItem[] = [];

        for (const connection of activeConnections) {
          if (signal?.aborted) {
            debugLog("info", "Fetch aborted by signal, breaking loop");
            break;
          }

          debugLog("info", `Processing connection: ${connection.name} (${connection.id})`);
          
          try {
            const headers: Record<string, string> = {};
            const queryParams = new URLSearchParams();

            connection.authentication.forEach((auth) => {
              if (auth.location === "header") {
                headers[auth.key] = auth.value;
              } else {
                queryParams.append(auth.key, auth.value);
              }
            });

            const url = `${connection.url}/apps.json${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
            debugLog("info", `Fetching apps from: ${url}`);

            // Create a new AbortController with timeout for this specific fetch
            const fetchController = new AbortController();
            const timeoutId = setTimeout(() => fetchController.abort(), 10000);
            const fetchStartTime = performance.now();

            // Listen for external signal abort
            signal?.addEventListener('abort', () => fetchController.abort());

            const response = await fetch(url, {
              headers,
              signal: fetchController.signal
            });
            clearTimeout(timeoutId);
            const fetchEndTime = performance.now();
            
            debugLog("info", `Fetch completed in ${(fetchEndTime - fetchStartTime).toFixed(2)}ms`, {
              status: response.status,
              statusText: response.statusText
            });

            if (response.ok) {
              debugLog("info", "Response is OK, parsing JSON");
              const connectionApps = await response.json();
              debugLog("info", `Parsed ${Array.isArray(connectionApps) ? connectionApps.length : Object.keys(connectionApps as object).length} items from response`, {
                rawType: Array.isArray(connectionApps) ? 'array' : typeof connectionApps,
                rawLength: Array.isArray(connectionApps) ? connectionApps.length : Object.keys(connectionApps as object).length
              });

              if (Array.isArray(connectionApps)) {
                debugLog("info", `Processing ${connectionApps.length} apps as array`);
                connectionApps.forEach((app: unknown) => {
                  apps.push({
                    ...(app as Record<string, unknown>),
                    connectionId: connection.id,
                    connectionName: connection.name,
                    widgetCount: calculateWidgetCount(app),
                  } as AppItem);
                });
              } else if (
                typeof connectionApps === "object" &&
                connectionApps !== null
              ) {
                const objKeys = Object.keys(connectionApps);
                debugLog("info", `Processing ${objKeys.length} apps as object`);
                Object.values(connectionApps).forEach((app: unknown) => {
                  apps.push({
                    ...(app as Record<string, unknown>),
                    connectionId: connection.id,
                    connectionName: connection.name,
                    widgetCount: calculateWidgetCount(app),
                  } as AppItem);
                });
              } else {
                debugLog("warn", `Unexpected response format: ${typeof connectionApps}`, { response: connectionApps });
              }
            } else {
              debugLog("error", `HTTP error: ${response.status} ${response.statusText}`, {
                url,
                status: response.status,
                statusText: response.statusText
              });
            }
          } catch (error) {
            const err = error as Error;
            if (err.name !== "AbortError") {
              debugLog("error", `Error loading apps from connection ${connection.name}: ${err.message}`, {
                connectionName: connection.name,
                connectionUrl: connection.url,
                errorType: err.name,
                errorMessage: err.message,
                errorStack: err.stack
              });
            } else {
              debugLog("info", `Fetch aborted for connection ${connection.name}`);
            }
          }
        }

        debugLog("success", `Fetch completed, returning ${apps.length} apps`, {
          totalApps: apps.length,
          appNames: apps.map(a => a.name)
        });

        this.apps = apps;
        this.lastFetchTime = Date.now();
        this.fetchPromise = null;
        return apps;
      } catch (error) {
        const err = error as Error;
        this.fetchPromise = null;
        if (err.name !== "AbortError") {
          debugLog("error", `Critical error in fetchApps: ${err.message}`, {
            errorType: err.name,
            errorMessage: err.message,
            errorStack: err.stack
          });
          console.error("Error loading apps:", error);
        } else {
          debugLog("info", "fetchApps aborted");
        }
        // Return empty array on error instead of cached data to avoid stale results
        this.apps = [];
        this.lastFetchTime = 0;
        return [];
      }
    };

    this.fetchPromise = fetchApps();
    return this.fetchPromise;
  }

  clearCache(): void {
    this.apps = [];
    this.lastFetchTime = 0;
    this.fetchPromise = null;
  }
}

const appService = new AppService();

async function createDashboardFromApp(app: AppItem): Promise<string | null> {
  // Initialize debug logging utility following app's existing logging format
  const isDebugMode = import.meta.env.VITE_DEBUG_MODE === "true";
  const debugLog = (level: "info" | "success" | "error" | "warn", message: string, data?: unknown) => {
    if (!isDebugMode) return;
    const timestamp = new Date().toISOString();
    const color = level === "error" ? "#EF4444" : level === "success" ? "#10B981" : level === "warn" ? "#F59E0B" : "#3B82F6";
    console.log(`%c[${timestamp}] [DASHBOARD_CREATOR] [${level.toUpperCase()}] ${message}`, `color: ${color}`, data);
  };

  try {
    debugLog("info", "Starting createDashboardFromApp execution", { appName: app.name });

    if (!app.name) {
      console.error("App name is required");
      return null;
    }

    const dashboardId = generateUUID();
    const timestamp = Date.now();
    
    debugLog("info", `Creating new dashboard`, { dashboardId, appName: app.name });
    
    // Include groups in dashboard creation if defined in app
    const dashboardGroups = app.groups?.map((group: { name: string; type: string; paramName: string; defaultValue: string | number | boolean; widgetIds: string[] }) => ({
      name: group.name,
      type: group.type,
      paramName: group.paramName,
      defaultValue: group.defaultValue,
      widgetIds: group.widgetIds,
    }));
    
    await createDashboard({
      id: dashboardId,
      name: app.name,
      description: app.description,
      groups: dashboardGroups,
    });

    if (!app.tabs || typeof app.tabs !== "object") {
      debugLog("warn", "App has no tabs configuration", { appName: app.name });
      return dashboardId;
    }

    debugLog("info", `Fetching widget definitions`);
    const widgetDefinitions = await widgetService.getWidgets();
    debugLog("info", `Fetched ${widgetDefinitions.length} widget definitions`);

    const widgetIdSet = new Set<string>();
    let widgetCount = 0;

    for (const tabId of Object.keys(app.tabs)) {
      const tab = app.tabs[tabId];
      if (!tab || !tab.layout || !Array.isArray(tab.layout)) {
        debugLog("warn", `Tab ${tabId} has invalid or missing layout`);
        continue;
      }

      debugLog("info", `Processing tab: ${tabId} (${tab.name || 'Unnamed'})`, { widgetCount: tab.layout.length });

      for (const layoutItem of tab.layout) {
        if (!layoutItem || typeof layoutItem.i !== "string") {
          debugLog("warn", "Invalid layout item: missing widget ID");
          continue;
        }

        const baseWidgetId = layoutItem.i;
        
        let uniqueWidgetId = `${baseWidgetId}-${timestamp}`;
        let counter = 1;
        
        while (widgetIdSet.has(uniqueWidgetId)) {
          uniqueWidgetId = `${baseWidgetId}-${timestamp}-${counter}`;
          counter++;
        }
        widgetIdSet.add(uniqueWidgetId);

        debugLog("info", `Generating unique widget ID`, { baseWidgetId, uniqueWidgetId });

        const widgetDef = widgetDefinitions.find(
          (def) =>
            def.id === baseWidgetId ||
            def.id === `built-in-${baseWidgetId}` ||
            baseWidgetId.startsWith(`${def.id}-`),
        );

        const widgetType = widgetDef?.type || "table";
        const widgetTitle = widgetDef?.name || baseWidgetId.split("/").pop() || baseWidgetId;

        const widget: Widget = {
          id: uniqueWidgetId,
          type: widgetType,
          title: widgetTitle,
          position: {
            x: layoutItem.x,
            y: layoutItem.y,
            w: layoutItem.w,
            h: layoutItem.h,
          },
          data: {
            widgetId: baseWidgetId,
            state: layoutItem.state,
            tabId: tab.id,
            tabName: tab.name,
            groups: app.groups,  // Include groups from app configuration
            ...widgetDef,
          },
        };

        // Log widget creation event immediately after widget initialization
        debugLog("success", `Widget instance created`, {
          uniqueWidgetId,
          baseWidgetId,
          widgetType,
          widgetTitle,
          tabId: tab.id,
          tabName: tab.name,
          position: widget.position,
          definitionFound: !!widgetDef,
        });

        await addWidget(dashboardId, widget);
        widgetCount++;
      }
    }

    debugLog("success", `Dashboard creation completed`, { dashboardId, appName: app.name, widgetCount });
    return dashboardId;
  } catch (error) {
    const err = error as Error;
    debugLog("error", `Failed to create dashboard from app: ${err.message}`, {
      appName: app.name,
      errorType: err.name,
      errorMessage: err.message,
      errorStack: err.stack,
    });
    console.error("Error creating dashboard from app:", error);
    return null;
  }
}

function AppsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(
    t("apps.categoryAll"),
  );
  const [apps, setApps] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState(true);
  const abortTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (abortTimeoutRef.current !== null) {
      clearTimeout(abortTimeoutRef.current);
      abortTimeoutRef.current = null;
    }

    let isMounted = true;
    const abortController = new AbortController();
    
    const loadApps = async () => {
      // Check if debug mode is enabled via environment variable
      const isDebugMode = import.meta.env.VITE_DEBUG_MODE === "true";
      
      // Helper function for formatted debug logs with timestamps
      const debugLog = (level: "info" | "success" | "error" | "warn", message: string, data?: unknown) => {
        if (!isDebugMode) return;
        
        const timestamp = new Date().toISOString();
        const colorMap = {
          info: "color: #3B82F6",
          success: "color: #10B981",
          error: "color: #EF4444",
          warn: "color: #F59E0B",
        };
        
        if (data) {
          console.log(`%c[${timestamp}] [APP_LOADER] [${level.toUpperCase()}] ${message}`, colorMap[level], data);
        } else {
          console.log(`%c[${timestamp}] [APP_LOADER] [${level.toUpperCase()}] ${message}`, colorMap[level]);
        }
      };

      const startTime = performance.now();
      let successCount = 0;
      let failCount = 0;
      const errors: Array<{ appId: string; error: Error }> = [];

      try {
        debugLog("info", "Initializing app loading process...");
        setLoading(true);

        debugLog("info", "Fetching apps from appService...");
        const fetchStartTime = performance.now();
        
        const data = await appService.getApps(abortController.signal);
        
        const fetchEndTime = performance.now();
        debugLog("info", `App data fetched in ${(fetchEndTime - fetchStartTime).toFixed(2)}ms`);

        if (isMounted) {
          debugLog("info", `Processing ${data.length} apps...`);
          
          data.forEach((app: AppItem, index: number) => {
            const appStartTime = performance.now();
            try {
              // Validate required fields
              if (!app.name || !app.connectionId) {
                throw new Error(`Missing required fields: name=${app.name}, connectionId=${app.connectionId}`);
              }
              
              debugLog("success", `Loaded app [${index + 1}/${data.length}]: ${app.name}`, {
                id: app.name,
                connectionId: app.connectionId,
                connectionName: app.connectionName,
                widgetCount: app.widgetCount,
                hasTabs: !!app.tabs,
                hasGroups: !!app.groups,
                img: app.img,
              });
              successCount++;
            } catch (appError) {
              failCount++;
              errors.push({ appId: app.name || `Unknown app ${index}`, error: appError as Error });
              debugLog("error", `Failed to load app [${index + 1}/${data.length}]: ${app.name || 'Unknown'}`, {
                errorType: (appError as Error).name,
                errorMessage: (appError as Error).message,
                errorStack: (appError as Error).stack,
              });
            } finally {
              const appEndTime = performance.now();
              debugLog("info", `App processing time [${index + 1}/${data.length}]: ${(appEndTime - appStartTime).toFixed(2)}ms`);
            }
          });

          setApps(data);
          setLoading(false);

          const totalTime = performance.now() - startTime;
          debugLog("info", `App loading completed. Total time: ${totalTime.toFixed(2)}ms`);
          debugLog("info", `Summary: ${successCount} successful, ${failCount} failed out of ${data.length} total apps`);
          
          if (errors.length > 0) {
            debugLog("warn", "Errors encountered during app loading:", errors);
          }
        }
      } catch (error) {
        const totalTime = performance.now() - startTime;
        
        if (isMounted && (error as Error).name !== "AbortError") {
          debugLog("error", `Critical error during app loading process`, {
            errorType: (error as Error).name,
            errorMessage: (error as Error).message,
            errorStack: (error as Error).stack,
            totalTime: `${totalTime.toFixed(2)}ms`,
          });
          console.error("Error loading apps:", error);
          setLoading(false);
        } else if ((error as Error).name === "AbortError") {
          debugLog("info", "App loading aborted by user");
        }
      }
    };
    
    loadApps();
    
    return () => {
      isMounted = false;
      abortTimeoutRef.current = setTimeout(() => {
        abortController.abort();
      }, 5000);
    };
  }, []);

  const handleRefresh = async (connectionId: string) => {
    try {
      await connectionService.refreshConnection(connectionId);
      // Reload apps after refresh with force refresh to bypass cache
      const abortController = new AbortController();
      const data = await appService.getApps(abortController.signal, true);
      setApps(data);
    } catch (error) {
      console.error("Error refreshing connection:", error);
    }
  };

  const categories = [t("apps.categoryAll"), t("apps.categoryPortfolio")];

  const filteredApps = apps.filter((app) => {
    const matchesSearch =
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="work-area">
      <div className="work-area-header">
        <div>
          <h1 className="work-area-title">{t("apps.title")}</h1>
          <p className="work-area-subtitle">{t("apps.subtitle")}</p>
        </div>
      </div>

      <div className="work-area-filters">
        <div className="flex-1">
          <Input
            type="text"
            placeholder={t("apps.search")}
            value={searchQuery}
            onChange={(value) => setSearchQuery(String(value))}
          />
        </div>
        <div className="flex space-x-2">
          {categories.map((category) => (
            <Button
              key={category}
              variant={selectedCategory === category ? "primary" : "ghost"}
              size="sm"
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </Button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="loading-state">
          <p>{t("apps.loading")}</p>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(250px,280px),1fr))] gap-6">
          {filteredApps.map((app, index) => (
            <ApplicationCard
              key={index}
              name={app.name}
              img={app.img}
              imgDark={app.img_dark}
              imgLight={app.img_light}
              description={app.description}
              connectionName={app.connectionName}
              widgetCount={app.widgetCount}
              connectionId={app.connectionId}
              onClick={async () => {
                try {
                  const dashboardId = await createDashboardFromApp(app);
                  if (dashboardId) {
                    navigate({ to: "/app/$id", params: { id: dashboardId } });
                  } else {
                    console.error("Failed to create dashboard from app:", app.name);
                  }
                } catch (error) {
                  console.error("Error creating dashboard:", error);
                }
              }}
              onRefresh={handleRefresh}
            />
          ))}
        </div>
      )}

      {!loading && filteredApps.length === 0 && (
        <div className="no-results">
          <Icon name={"search" as never} className="no-results-icon" />
          <p>{t("apps.noResults")}</p>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/app/")({
  component: AppsPage,
});
