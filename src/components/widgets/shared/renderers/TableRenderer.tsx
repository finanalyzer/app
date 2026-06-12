import { useMemo, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { ModuleRegistry, AllCommunityModule, themeQuartz } from 'ag-grid-community';
import type { ColDef, GridReadyEvent, ValueFormatterParams, ICellRendererParams } from 'ag-grid-community';
import type { WidgetInstance } from '../../../../types/widgets';
import type { CellOnClickRenderParams } from '../../../../types/widgets';
import type { TableSettings } from '../../TableSettingsModal';
import './AgGridTheme.css';

// Register all community modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface ColumnDef {
  field: string;
  headerName?: string;
  headerTooltip?: string;
  cellDataType?: string;
  pinned?: 'left' | 'right' | null;
  formatterFn?: string;
  renderFn?: string;
  renderFnParams?: Record<string, unknown>;
  filter?: boolean;
  sortable?: boolean;
  resizable?: boolean;
  flex?: number;
  minWidth?: number;
  width?: number;
}

interface TableData {
  columns: string[];
  rows: Record<string, unknown>[];
}

interface TableRendererContext {
  onUpdate?: (params: Record<string, unknown>) => void;
}

function transformToTableData(rawData: unknown): TableData {
  if (!rawData) {
    return { columns: [], rows: [] };
  }

  if (Array.isArray(rawData)) {
    const columns =
      rawData.length > 0
        ? Object.keys(rawData[0]).filter((key) => key !== "id")
        : [];
    return {
      columns,
      rows: rawData.map((item, index) => ({
        id: (item as Record<string, unknown>).id ?? index,
        ...item,
      })),
    };
  }

  const dataObj = rawData as Record<string, unknown>;
  if (dataObj.rows && Array.isArray(dataObj.rows)) {
    const columns =
      (dataObj.columns as string[]) ||
      (dataObj.rows.length > 0
        ? Object.keys(dataObj.rows[0]).filter((key) => key !== "id")
        : []);
    return {
      columns: Array.isArray(columns) ? columns : Object.keys(columns),
      rows: dataObj.rows as Record<string, unknown>[],
    };
  }

  if (typeof rawData === 'object' && rawData !== null) {
    const columns = Object.keys(rawData).filter((key) => key !== "id");
    return {
      columns,
      rows: [{
        id: (rawData as Record<string, unknown>).id ?? 0,
        ...rawData as Record<string, unknown>,
      }],
    };
  }

  return { columns: [], rows: [] };
}

function percentFormatter(params: ValueFormatterParams): string {
  const value = params.value;
  if (value === null || value === undefined) return '';
  const numValue = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(numValue)) return String(value);
  return `${numValue.toFixed(2)}%`;
}

function dateStringFormatter(params: ValueFormatterParams): string {
  const value = params.value;
  if (value === null || value === undefined || value === '') return '';
  
  const dateStr = String(value);
  
  // Try to parse the date string with different formats
  let date: Date;
  
  // Check if it's a Unix timestamp (seconds or milliseconds)
  const numValue = Number(dateStr);
  if (!isNaN(numValue) && numValue > 0) {
    // If the number is very large, it's likely milliseconds
    // If the number is reasonable, it's likely seconds
    if (numValue > 1e12) {
      date = new Date(numValue);
    } else {
      date = new Date(numValue * 1000);
    }
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  
  // Format 1: YYYY-MM-DD (HTML date input format)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    date = new Date(dateStr + 'T00:00:00');
  }
  // Format 2: YYYY/MM/DD
  else if (/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) {
    const parts = dateStr.split('/');
    date = new Date(`${parts[0]}-${parts[1]}-${parts[2]}T00:00:00`);
  }
  // Format 3: MM/DD/YYYY
  else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const parts = dateStr.split('/');
    date = new Date(`${parts[2]}-${parts[0]}-${parts[1]}T00:00:00`);
  }
  // Format 4: DD/MM/YYYY
  else if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
    const parts = dateStr.split('/');
    date = new Date(`${parts[2]}-${parts[1]}-${parts[0]}T00:00:00`);
  }
  // Format 5: ISO string (YYYY-MM-DDTHH:mm:ss.sssZ)
  else if (/^\d{4}-\d{2}-\d{2}T/.test(dateStr)) {
    date = new Date(dateStr);
  }
  // Format 6: Date with time (YYYY-MM-DD HH:mm:ss)
  else if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(dateStr)) {
    date = new Date(dateStr.replace(' ', 'T'));
  }
  // Format 7: Chinese date format (YYYY年MM月DD日)
  else if (/^\d{4}年\d{1,2}月\d{1,2}日$/.test(dateStr)) {
    const match = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
    if (match) {
      date = new Date(`${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}T00:00:00`);
    } else {
      return dateStr;
    }
  }
  // Default: try to parse as-is
  else {
    date = new Date(dateStr);
  }
  
  // Check if the date is valid
  if (isNaN(date.getTime())) {
    return dateStr;
  }
  
  // Format the date as YYYY-MM-DD
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

export function createNumberFormatter(decimalPlaces: number): (params: ValueFormatterParams) => string {
  return (params: ValueFormatterParams): string => {
    const value = params.value;
    if (value === null || value === undefined) return '';
    const numValue = typeof value === 'number' ? value : parseFloat(String(value));
    if (isNaN(numValue)) return String(value);
    return numValue.toFixed(decimalPlaces);
  };
}



function columnColorRenderer(params: ICellRendererParams): JSX.Element {
  const value = params.value;
  const renderFnParams = (params.colDef as Record<string, unknown>).renderFnParams as Record<string, unknown>;
  const colorRules = renderFnParams?.colorRules as Array<Record<string, unknown>> || [];

  let color = '';
  for (const rule of colorRules) {
    const condition = rule.condition as string;
    const ruleValue = rule.value;
    const ruleColor = rule.color as string;
    const range = rule.range as { min?: number; max?: number };

    switch (condition) {
      case 'contains':
        if (String(value).includes(String(ruleValue))) {
          color = ruleColor;
        }
        break;
      case 'gt':
        if (Number(value) > Number(ruleValue)) {
          color = ruleColor;
        }
        break;
      case 'lt':
        if (Number(value) < Number(ruleValue)) {
          color = ruleColor;
        }
        break;
      case 'between':
        if (range && Number(value) >= Number(range.min) && Number(value) <= Number(range.max)) {
          color = ruleColor;
        }
        break;
      case 'eq':
        if (value === ruleValue) {
          color = ruleColor;
        }
        break;
    }
    if (color) break;
  }

  const colorMap: Record<string, string> = {
    'red': 'text-red-500 dark:text-red-400',
    'green': 'text-green-500 dark:text-green-400',
    'blue': 'text-blue-500 dark:text-blue-400',
    'yellow': 'text-yellow-500 dark:text-yellow-400',
    'orange': 'text-orange-500 dark:text-orange-400',
    'purple': 'text-purple-500 dark:text-purple-400',
  };

  const textColorClass = colorMap[color] || '';

  return (
    <span className={textColorClass}>{value}</span>
  );
}

function cellOnClickRenderer(params: ICellRendererParams): JSX.Element {
  const value = params.value;
  const colDef = params.colDef as Record<string, unknown>;
  const renderFnParams = colDef.renderFnParams as CellOnClickRenderParams | undefined;

  const handleClick = () => {
    if (!renderFnParams || renderFnParams.actionType !== 'groupBy') {
      return;
    }

    const { groupByParamName, groupBy } = renderFnParams;
    const paramName = groupByParamName ?? groupBy?.paramName;
    const valueField = groupBy?.valueField || colDef.field as string;

    if (!paramName) {
      console.warn('[TableRenderer] paramName is undefined in renderFnParams');
      return;
    }

    if (!valueField) {
      console.warn('[TableRenderer] No valueField or field specified for cellOnClick');
      return;
    }

    const cellValue = params.data?.[valueField] ?? params.value;

    if (cellValue === null || cellValue === undefined || cellValue === '') {
      console.warn('[TableRenderer] Cell value is empty, skipping update');
      return;
    }

    const { context } = params as ICellRendererParams & { context?: TableRendererContext };
    const onUpdate = context?.onUpdate;

    if (onUpdate && typeof onUpdate === 'function') {
      onUpdate({ [paramName]: cellValue });
    }
  };

  return (
    <span
      className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline"
      onClick={handleClick}
      title="Click to update related widgets"
    >
      {value}
    </span>
  );
}

function createColumnDefsFromConfig(columnsDefs: ColumnDef[], availableColumns: string[]): ColDef[] {
  return columnsDefs.map((colDef) => {
    const column: ColDef = {
      field: colDef.field,
      headerName: colDef.headerName || colDef.field.charAt(0).toUpperCase() + colDef.field.slice(1),
      headerTooltip: colDef.headerTooltip,
      pinned: colDef.pinned || undefined,
      filter: colDef.filter !== undefined ? colDef.filter : true,
      sortable: colDef.sortable !== undefined ? colDef.sortable : true,
      resizable: colDef.resizable !== undefined ? colDef.resizable : true,
      flex: colDef.flex || 1,
      minWidth: colDef.minWidth || colDef.width || 100,
      width: colDef.width || undefined,
      cellDataType: colDef.cellDataType,
    };

    if (colDef.formatterFn === 'percent') {
      column.valueFormatter = percentFormatter;
    }
    
    if (colDef.cellDataType === 'dateString') {
      column.valueFormatter = dateStringFormatter;
    }
    
    if (isNumericColumn(colDef.field)) {
      column.cellStyle = { textAlign: 'right' };
    }

    if (colDef.renderFn === 'columnColor') {
      column.cellRenderer = columnColorRenderer;
      (column as Record<string, unknown>).renderFnParams = colDef.renderFnParams;
    }

    if (colDef.renderFn === 'cellOnClick') {
      column.cellRenderer = cellOnClickRenderer;
      (column as Record<string, unknown>).renderFnParams = colDef.renderFnParams;
    }

    return column;
  }).filter((col): col is ColDef & { field: string } => 
    typeof col.field === 'string' && availableColumns.includes(col.field)
  );
}

function isNumericColumn(col: string): boolean {
  const numericSuffixes = ['_pct', '_percent', '_change', '_return', '_yield'];
  const numericKeywords = ['price', 'close', 'open', 'high', 'low', 'volume', 'amount', 'value', 'rate', 'ratio', 'yield', 'return', 'change', 'percent', 'pct', 'eps', 'pe', 'pb', 'roe', 'roa'];
  
  const lowerCol = col.toLowerCase();
  
  if (numericSuffixes.some(suffix => lowerCol.endsWith(suffix))) {
    return true;
  }
  
  if (numericKeywords.some(keyword => lowerCol.includes(keyword))) {
    return true;
  }
  
  return false;
}

function createColumnDefs(columns: string[]): ColDef[] {
  return columns.map((col) => {
    const column: ColDef = {
      field: col,
      headerName: col.charAt(0).toUpperCase() + col.slice(1),
      filter: true,
      sortable: true,
      resizable: true,
      flex: 1,
      minWidth: 100,
    };
    
    if (isNumericColumn(col)) {
      column.cellStyle = { textAlign: 'right' };
    }
    
    return column;
  });
}

interface TableRendererProps {
  data: unknown;
  widget?: WidgetInstance;
  onUpdate?: (params: Record<string, unknown>) => void;
  settings?: TableSettings;
}

export function TableRenderer({ data, widget, onUpdate, settings }: TableRendererProps): JSX.Element {
  const tableData = useMemo(() => transformToTableData(data), [data]);

  const { decimalPlaces = 2, visibleColumns } = settings || {};

  const effectiveColumns = useMemo(() => {
    if (visibleColumns && visibleColumns.length > 0) {
      return visibleColumns.filter(col => tableData.columns.includes(col));
    }
    return tableData.columns;
  }, [tableData.columns, visibleColumns]);

  const columnDefs = useMemo(() => {
    let baseDefs: ColDef[] | undefined;
    
    if (widget) {
      const widgetAny = widget as unknown as Record<string, unknown>;
      
      // Check path 1: widget.tableConfig (set by DashboardCanvas)
      const tableConfig = widgetAny.tableConfig as Record<string, unknown> | undefined;
      if (tableConfig && (tableConfig as Record<string, unknown>).columnsDefs) {
        const columnsDefs = (tableConfig as Record<string, unknown>).columnsDefs as ColumnDef[];
        if (columnsDefs && Array.isArray(columnsDefs) && columnsDefs.length > 0) {
          baseDefs = createColumnDefsFromConfig(columnsDefs, effectiveColumns);
        }
      }
      
      // Check path 2: widget.data is WidgetConfig with data.data.table.columnsDefs
      // (when widget.data = widgetConfig from widgets.json via handleAddWidgetsFromMenu)
      const widgetData = widgetAny.data as Record<string, unknown> | undefined;
      if (!baseDefs && widgetData) {
        // widgetData might be the WidgetConfig itself (has id, name, data, etc.)
        const tableDataObj = widgetData.data as Record<string, unknown> | undefined;
        if (tableDataObj) {
          const table = tableDataObj.table as Record<string, unknown> | undefined;
          if (table) {
            const columnsDefs = table.columnsDefs as ColumnDef[] | undefined;
            if (columnsDefs && Array.isArray(columnsDefs) && columnsDefs.length > 0) {
              baseDefs = createColumnDefsFromConfig(columnsDefs, effectiveColumns);
            }
          }
        }
        
        // Or widgetData might be directly the table config (has columnsDefs directly)
        if (!baseDefs && (widgetData as Record<string, unknown>).columnsDefs) {
          const columnsDefs = (widgetData as Record<string, unknown>).columnsDefs as ColumnDef[];
          if (columnsDefs && Array.isArray(columnsDefs) && columnsDefs.length > 0) {
            baseDefs = createColumnDefsFromConfig(columnsDefs, effectiveColumns);
          }
        }
      }
    }
    
    if (!baseDefs) {
      baseDefs = createColumnDefs(effectiveColumns);
    }
    
    // Apply decimalPlaces formatting
    if (decimalPlaces >= 0) {
      const numberFormatter = createNumberFormatter(decimalPlaces);
      return baseDefs.map(col => {
        const colRecord = col as Record<string, unknown>;
        // Skip formatting for percent, dateString, and other special cellDataTypes
        if (colRecord.formatterFn !== 'percent' && colRecord.cellDataType !== 'dateString') {
          return {
            ...col,
            valueFormatter: numberFormatter,
          };
        }
        return col;
      });
    }
    
    return baseDefs;
  }, [effectiveColumns, widget, decimalPlaces]);

  const onGridReady = useCallback((params: GridReadyEvent) => {
    params.api.sizeColumnsToFit();
  }, []);

  if (!tableData || tableData.rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
        No data available
      </div>
    );
  }

  return (
    <div className="ag-grid-table-widget h-full w-full bg-white dark:bg-dark-900 rounded-lg shadow-sm">
      <AgGridReact
        theme={themeQuartz}
        rowData={tableData.rows}
        columnDefs={columnDefs}
        onGridReady={onGridReady}
        context={{ onUpdate } as TableRendererContext}
        defaultColDef={{
          filter: true,
          floatingFilter: false,
          sortable: true,
          resizable: true,
          flex: 1,
          minWidth: 100,
        }}
        pagination={false}
        animateRows={true}
        rowHeight={32}
        headerHeight={33}
      />
    </div>
  );
}