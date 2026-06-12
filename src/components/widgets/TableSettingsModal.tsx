import { Button, Checkbox, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, RadioGroup, RadioGroupItem } from "@openbb/ui";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

export interface TableSettings {
  decimalPlaces: number;
  visibleColumns: string[];
}

export interface ColumnDef {
  field: string;
  headerName?: string;
}

export type { ColumnDef as TableColumnDef };

interface TableSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: TableSettings) => void;
  currentSettings: TableSettings;
  columnDefs: ColumnDef[];
}

export function TableSettingsModal({
  isOpen,
  onClose,
  onSave,
  currentSettings,
  columnDefs,
}: TableSettingsModalProps): JSX.Element {
  const { t } = useTranslation();
  const [decimalPlaces, setDecimalPlaces] = useState(currentSettings.decimalPlaces);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(currentSettings.visibleColumns);
  const availableColumns = columnDefs.map(c => c.field);

  useEffect(() => {
    if (isOpen) {
      setDecimalPlaces(currentSettings.decimalPlaces);
      setVisibleColumns([...currentSettings.visibleColumns]);
    }
  }, [isOpen, currentSettings]);

  const handleToggleColumn = (column: string) => {
    setVisibleColumns((prev) => {
      if (prev.includes(column)) {
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter((c) => c !== column);
      }
      return [...prev, column];
    });
  };

  const handleSelectAll = () => {
    if (visibleColumns.length === availableColumns.length) {
      setVisibleColumns(availableColumns.slice(0, 1));
    } else {
      setVisibleColumns([...availableColumns]);
    }
  };

  const handleSave = () => {
    onSave({ decimalPlaces, visibleColumns });
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("tableSettings.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t("tableSettings.decimalPlaces")}
            </label>
            <RadioGroup
              value={decimalPlaces.toString()}
              onValueChange={(val) => setDecimalPlaces(Number(val))}
              className="flex items-end flex-wrap gap-4 justify-between"
            >
              {[0, 1, 2, 3, 4, 5].map((value) => {
                const exampleNumber = 1.23456;
                const displayValue = exampleNumber.toFixed(value);
                return (
                  <RadioGroupItem
                    key={value}
                    value={value.toString()}
                    label={displayValue}
                  />
                );
              })}
            </RadioGroup>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t("tableSettings.decimalPlacesDescription")}
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t("tableSettings.visibleColumns")}
              </label>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                {visibleColumns.length === availableColumns.length 
                  ? t("tableSettings.deselectAll")
                  : t("tableSettings.selectAll")}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {columnDefs.map((colDef) => (
                <label
                  key={colDef.field}
                  className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${
                    visibleColumns.includes(colDef.field)
                      ? "bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700"
                      : "bg-gray-50 dark:bg-dark-800 border-gray-200 dark:border-dark-600 hover:bg-gray-100 dark:hover:bg-dark-700"
                  }`}
                >
                  <Checkbox
                    checked={visibleColumns.includes(colDef.field)}
                    onCheckedChange={() => handleToggleColumn(colDef.field)}
                    disabled={visibleColumns.length === 1 && visibleColumns.includes(colDef.field)}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">
                    {colDef.headerName || colDef.field}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t("tableSettings.visibleColumnsDescription")}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outlined" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={visibleColumns.length === 0}
          >
            {t("common.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default TableSettingsModal;
