import type { WidgetInstanceProps } from "../../../types/widgets";
import { BaseWidget } from "./BaseWidget";
import { TableRenderer } from "./renderers";
import type { TableSettings } from "../TableSettingsModal";

interface TableWidgetProps extends WidgetInstanceProps {
  settings?: TableSettings;
}

export function TableWidget(props: TableWidgetProps): JSX.Element {
  const { settings, ...baseProps } = props;
  
  return (
    <BaseWidget
      {...baseProps}
      render={({ data, widget, onUpdate }) => (
        <TableRenderer 
          data={data} 
          widget={widget} 
          onUpdate={onUpdate} 
          settings={settings}
        />
      )}
    />
  );
}

export default TableWidget;
