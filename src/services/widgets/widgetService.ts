import type { WidgetConfig, WidgetParameter } from "../../types/widgets";
import { connectionService, normalizeBaseUrl } from "../connections/connectionService";
import { WidgetFactory } from "./widgetFactory";

/** Resolves OpenBB date modifiers like "$currentDate", "$currentDate-1d" to actual dates */
function resolveDateModifier(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('$currentDate')) return raw;

  const now = new Date();
  const daysMatch = trimmed.match(/\$currentDate([+-]\d+)d/);
  if (daysMatch) {
    const offset = parseInt(daysMatch[1], 10);
    now.setDate(now.getDate() + offset);
  }
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

class WidgetService {
  private widgets: WidgetConfig[] = [];
  private lastFetchTime = 0;
  private cacheDuration = 30000;
  private fetchPromise: Promise<WidgetConfig[]> | null = null;

  async getWidgets(signal?: AbortSignal, forceRefresh = false): Promise<WidgetConfig[]> {
    try {
      const now = Date.now();

      if (this.fetchPromise && !forceRefresh) {
        return this.fetchPromise;
      }

      if (!forceRefresh && now - this.lastFetchTime < this.cacheDuration && this.widgets.length > 0) {
        return this.widgets;
      }

      const connections = connectionService.getConnections();
      const activeConnections = connections.filter(
        (conn) => conn.status === "connected",
      );

      const fetchWidgets = async (): Promise<WidgetConfig[]> => {
        const widgets: WidgetConfig[] = [];

        const builtInWidgets = this.getBuiltInWidgets();
        widgets.push(...builtInWidgets);

        for (const connection of activeConnections) {
          if (signal?.aborted) break;

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

            const url = `${normalizeBaseUrl(connection.url)}/widgets.json${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;

            const fetchController = new AbortController();
            const timeoutId = setTimeout(() => fetchController.abort(), 10000);

            signal?.addEventListener('abort', () => fetchController.abort());

            const response = await fetch(url, { headers, signal: fetchController.signal });

            clearTimeout(timeoutId);

            if (response.ok) {
              const connectionWidgets = await response.json();

              if (Array.isArray(connectionWidgets)) {
                connectionWidgets.forEach((widget: unknown) => {
                  const widgetConfig = this.convertToWidgetConfig(
                    widget as Record<string, unknown>,
                    connection,
                  );
                  widgets.push(widgetConfig);
                });
              } else if (
                typeof connectionWidgets === "object" &&
                connectionWidgets !== null
              ) {
                Object.entries(connectionWidgets).forEach(([key, widget]: [string, unknown]) => {
                  const widgetRecord = widget as Record<string, unknown>;
                  // Use the JSON key as the widget ID if not explicitly provided
                  if (!widgetRecord.id && !widgetRecord.widgetId && !widgetRecord._id) {
                    widgetRecord.id = key;
                  }
                  const widgetConfig = this.convertToWidgetConfig(
                    widgetRecord,
                    connection,
                  );
                  widgets.push(widgetConfig);
                });
              }
            }
          } catch (error) {
            if ((error as Error).name !== "AbortError") {
              console.error(
                `Error loading widgets from connection ${connection.name}:`,
                error,
              );
            }
          }
        }

        this.widgets = widgets;
        this.lastFetchTime = Date.now();
        this.fetchPromise = null;
        return widgets;
      };

      this.fetchPromise = fetchWidgets();
      return this.fetchPromise;
    } catch (error) {
      console.error("Error loading widgets:", error);
      this.fetchPromise = null;
      this.widgets = [];
      this.lastFetchTime = 0;
      return [];
    }
  }

  clearCache(): void {
    this.widgets = [];
    this.lastFetchTime = 0;
    this.fetchPromise = null;
  }

  getCachedWidgets(): WidgetConfig[] {
    return this.widgets;
  }

  // Get built-in widgets from registered widget types
  private getBuiltInWidgets(): WidgetConfig[] {
    const widgetTypes = WidgetFactory.getWidgetTypes();

    return widgetTypes.map((typeDef) => ({
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

  // Convert backend widget format to WidgetConfig
  private convertToWidgetConfig(widget: any, connection: any): WidgetConfig {
    // Convert params to WidgetParameter format
    const params: WidgetParameter[] = (widget.params || []).map(
      (param: any) => {
        // Map "text" type with static options to "dropdown" per OpenBB spec
        let paramType = param.type;
        if (paramType === "text" && Array.isArray(param.options) && param.options.length > 0) {
          paramType = "dropdown";
        }

        // Resolve date modifiers for date-type parameters
        const resolvedValue = paramType === 'date' ? resolveDateModifier(param.value) : param.value;
        const resolvedDefault = paramType === 'date' ? resolveDateModifier(param.default !== undefined ? param.default : param.value) : (param.default !== undefined ? param.default : param.value);

        return {
          name: param.name || param.paramName,
          paramName: param.paramName,
          type: paramType,
          label: param.label || param.name,
          description: param.description,
          default: resolvedDefault,
          value: resolvedValue,
          required: param.required,
          options: param.options,
          min: param.min,
          max: param.max,
          step: param.step,
          optionsEndpoint: param.optionsEndpoint,
          optionsParams: param.optionsParams,
          multiSelect: param.multiSelect,
          style: param.style,
          endpoint: param.endpoint,
          inputParams: param.inputParams,
          dependsOn: param.dependsOn,
          show: param.show,
          optional: param.optional,
        };
      },
    );

    return {
      id: widget.id || widget.widgetId || widget._id || "",
      name: widget.name,
      description: widget.description,
      type: widget.type,
      category: widget.category,
      subcategory: widget.subcategory,
      endpoint: widget.endpoint,
      gridData: widget.gridData || { w: 4, h: 3 },
      params,
      source: "backend",
      connectionId: connection.id,
      connectionName: connection.name,
      connectionUrl: connection.url,
      connectionStatus: connection.status,
      connectionAuthentication: connection.authentication || [],
      data: widget.data,
    };
  }
}

export const widgetService = new WidgetService();
export type { WidgetConfig };