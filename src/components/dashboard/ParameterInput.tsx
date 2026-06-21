

import type { WidgetParameterType, WidgetParameter, Group } from '../../types/widgets';
import { isEndpointParameter } from '../../types/widgets';
import FormParameterComponent from '../widgets/shared/FormParameterComponent';
import EndpointParameterComponent from '../widgets/shared/EndpointParameterComponent';
import DropdownParameterComponent from '../widgets/shared/DropdownParameterComponent';
import TickerParameterComponent from '../widgets/shared/TickerParameterComponent';
import DatePickerParameterComponent from '../widgets/shared/DatePickerParameterComponent';

interface ParameterInputProps {
  paramName: string;
  label: string;
  type?: WidgetParameterType;
  value: unknown;
  onChange: (paramName: string, value: unknown) => void;
  options?: Array<{ value: unknown; label: string }>;
  parameter?: WidgetParameter;
  onFormSubmit?: (result: unknown) => void;
  disabled?: boolean;
  connectionUrl?: string;
  widgetId?: string;
  instanceId?: string;
  groupInfo?: Group;
}

export function ParameterInput({
  paramName,
  label,
  type = 'string',
  value,
  onChange,
  options,
  parameter,
  onFormSubmit,
  disabled = false,
  connectionUrl = '',
  widgetId = paramName,
  instanceId = paramName,
  groupInfo,
}: ParameterInputProps): JSX.Element {
  const toBoolean = (val: unknown): boolean => {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'string') return val === 'true';
    return Boolean(val);
  };

  const handleBooleanChange = () => {
    onChange(paramName, !toBoolean(value));
  };

  const inputClasses = "obb-minimal-input bg-transparent dark:bg-transparent px-0 h-[18.8px]! border-none! w-[96px] min-w-[96px] max-w-[200px] text-xs text-grey-900 dark:text-grey-100 placeholder:text-grey-500 dark:placeholder:text-grey-400 focus:outline-none";

  if (type === 'form' && parameter) {
    return (
      <FormParameterComponent
        parameter={parameter}
        value={(value as Record<string, unknown>) || {}}
        onChange={(newValue) => onChange(paramName, newValue)}
        onSubmit={onFormSubmit}
        disabled={disabled}
        connectionUrl={connectionUrl}
      />
    );
  }

  switch (type) {
    case 'boolean':
      return (
        <div className="obb-parameter flex items-center justify-between gap-1 h-[20px]">
          <input
            type="checkbox"
            id={`param-${paramName}`}
            checked={toBoolean(value)}
            onChange={handleBooleanChange}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <label htmlFor={`param-${paramName}`} className="text-xs text-grey-700 dark:text-grey-300 cursor-pointer">
            {label}
          </label>
        </div>
      );

    case 'number':
      return (
        <div className="obb-parameter flex items-center justify-between gap-1 h-[20px]">
          <input
            type="number"
            id={`param-${paramName}`}
            placeholder={label}
            value={value !== undefined && value !== null ? String(value) : ''}
            onChange={(e) => onChange(paramName, e.target.value ? parseFloat(e.target.value) : '')}
            className={inputClasses}
          />
        </div>
      );

    case 'select': {
      const selectOptions = options?.map((option) => ({
        label: option.label,
        value: String(option.value)
      })) || [];

      return (
        <div className="obb-parameter flex items-center justify-between gap-1 h-[20px]">
          <select
            id={`param-${paramName}`}
            value={String(value || '')}
            onChange={(e) => onChange(paramName, e.target.value)}
            className={`${inputClasses} cursor-pointer bg-transparent dark:bg-transparent`}
          >
            <option value="">{label}</option>
            {selectOptions.map((option, index) => (
              <option key={index} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    case 'dropdown':
      if (parameter) {
        return (
          <DropdownParameterComponent
            parameter={parameter}
            value={String(value || parameter.default || '')}
            onChange={(newValue) => onChange(paramName, newValue)}
            disabled={disabled}
            groupInfo={groupInfo}
          />
        );
      }
      // Fallback to select if no parameter object
      return (
        <div className="obb-parameter flex items-center justify-between gap-1 h-[20px]">
          <select
            id={`param-${paramName}`}
            value={String(value || '')}
            onChange={(e) => onChange(paramName, e.target.value)}
            className={`${inputClasses} cursor-pointer bg-transparent dark:bg-transparent`}
          >
            <option value="">{label}</option>
          </select>
        </div>
      );

    case 'date':
      if (parameter) {
        return (
          <DatePickerParameterComponent
            parameter={parameter}
            value={String(value || parameter.default || '')}
            onChange={(newValue) => onChange(paramName, newValue)}
            disabled={disabled}
            groupInfo={groupInfo}
          />
        );
      }
      // Fallback to native date input if no parameter object
      return (
        <div className="obb-parameter flex items-center justify-between gap-1 h-[20px]">
          <input
            type="date"
            id={`param-${paramName}`}
            value={String(value || '')}
            onChange={(e) => onChange(paramName, e.target.value)}
            className={inputClasses}
          />
        </div>
      );

    case 'color':
      return (
        <div className="obb-parameter flex items-center justify-between gap-1 h-[20px]">
          <input
            type="color"
            id={`param-${paramName}`}
            value={String(value || '#000000')}
            onChange={(e) => onChange(paramName, e.target.value)}
            className="w-8 h-[18.8px]! cursor-pointer border-none!"
          />
        </div>
      );

    case 'endpoint':
      if (parameter && isEndpointParameter(parameter) && widgetId && instanceId) {
        return (
          <EndpointParameterComponent
            parameter={parameter}
            value={String(value || parameter.default || '')}
            onChange={(newValue) => onChange(paramName, newValue)}
            widgetId={widgetId}
            instanceId={instanceId}
            disabled={disabled}
            connectionUrl={connectionUrl}
            groupInfo={groupInfo}
          />
        );
      }
      // Fallback to text input if no parameter object provided
      return (
        <div className="obb-parameter flex items-center justify-between gap-1 h-[20px]">
          <input
            type="text"
            id={`param-${paramName}`}
            placeholder={label}
            value={String(value || '')}
            onChange={(e) => onChange(paramName, e.target.value)}
            className={inputClasses}
          />
        </div>
      );

    case 'ticker':
      if (parameter && widgetId && instanceId) {
        return (
          <TickerParameterComponent
            parameter={parameter}
            value={String(value || '')}
            onChange={(newValue) => onChange(paramName, newValue)}
            widgetId={widgetId}
            instanceId={instanceId}
            disabled={disabled}
            connectionUrl={connectionUrl}
            groupInfo={groupInfo}
          />
        );
      }
      // Fallback to text input
      return (
        <div className="obb-parameter flex items-center justify-between gap-1 h-[20px]">
          <input
            type="text"
            id={`param-${paramName}`}
            placeholder={label}
            value={String(value || '')}
            onChange={(e) => onChange(paramName, e.target.value)}
            className={inputClasses}
          />
        </div>
      );

    case 'tabs':
    default:
      return (
        <div className="obb-parameter flex items-center justify-between gap-1 h-[20px]">
          <input
            type="text"
            id={`param-${paramName}`}
            placeholder={label}
            value={String(value || '')}
            onChange={(e) => onChange(paramName, e.target.value)}
            className={inputClasses}
          />
        </div>
      );
  }
}

export default ParameterInput;
