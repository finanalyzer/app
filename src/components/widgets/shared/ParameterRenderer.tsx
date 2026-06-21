import React, { memo, useCallback } from 'react';
import type { WidgetParameter, Group } from '../../../types/widgets';
import { isEndpointParameter, isFormParameter } from '../../../types/widgets';
import EndpointParameterComponent from './EndpointParameterComponent';
import FormParameterComponent from './FormParameterComponent';
import DropdownParameterComponent from './DropdownParameterComponent';
import TickerParameterComponent from './TickerParameterComponent';
import DatePickerParameterComponent from './DatePickerParameterComponent';
import { Input, Select, Checkbox } from '@openbb/ui';

interface ParameterRendererProps {
  parameter: WidgetParameter;
  value: unknown;
  onChange: (value: unknown) => void;
  widgetId: string;
  instanceId: string;
  disabled?: boolean;
  onFormSubmit?: (result: unknown) => void;
  connectionUrl?: string;
  groupInfo?: Group;
}

const ParameterRenderer: React.FC<ParameterRendererProps> = ({
  parameter,
  value,
  onChange,
  widgetId,
  instanceId,
  disabled = false,
  onFormSubmit,
  connectionUrl,
  groupInfo,
}) => {
  const handleStringChange = useCallback((value: string | number) => {
    onChange(String(value));
  }, [onChange]);

  const handleNumberChange = useCallback((value: string | number) => {
    const inputValue = String(value);
    onChange(inputValue === '' ? '' : parseFloat(inputValue));
  }, [onChange]);

  const handleBooleanChange = useCallback(() => {
    onChange(!value);
  }, [onChange, value]);

  const handleSelectChange = useCallback((value: string) => {
    onChange(value);
  }, [onChange]);

  const handleDateChange = useCallback((value: string | number) => {
    onChange(String(value));
  }, [onChange]);

  const handleColorChange = useCallback((value: string | number) => {
    onChange(String(value));
  }, [onChange]);

  if (isEndpointParameter(parameter)) {
    return (
      <EndpointParameterComponent
        parameter={parameter}
        value={String(value || '')}
        onChange={(newValue) => onChange(newValue)}
        widgetId={widgetId}
        instanceId={instanceId}
        disabled={disabled}
        connectionUrl={connectionUrl}
        groupInfo={groupInfo}
      />
    );
  }

  if (isFormParameter(parameter)) {
    return (
      <FormParameterComponent
        parameter={parameter}
        value={value as Record<string, unknown> || {}}
        onChange={(newValue) => onChange(newValue)}
        onSubmit={onFormSubmit}
        disabled={disabled}
      />
    );
  }

  switch (parameter.type) {
    case 'string':
      return (
        <Input
          type="text"
          value={String(value || '')}
          onChange={handleStringChange}
          placeholder={parameter.description || parameter.label}
          disabled={disabled}
          aria-label={parameter.label}
        />
      );

    case 'number':
      return (
        <Input
          type="number"
          value={value !== undefined && value !== null ? String(value) : ''}
          onChange={handleNumberChange}
          placeholder={parameter.description || parameter.label}
          min={parameter.min}
          max={parameter.max}
          step={parameter.step}
          disabled={disabled}
          aria-label={parameter.label}
        />
      );

    case 'boolean':
      return (
        <div className="flex items-center">
          <Checkbox
            checked={Boolean(value)}
            onChange={handleBooleanChange}
            disabled={disabled}
            aria-label={parameter.label}
          />
        </div>
      );

    case 'select':
      const selectOptions = parameter.options?.map((option) => ({
        label: option.label,
        value: String(option.value)
      })) || [];
      
      return (
        <Select
          value={String(value || '')}
          onChange={handleSelectChange}
          disabled={disabled}
          aria-label={parameter.label}
          options={[
            { label: `Select ${parameter.label}`, value: '' },
            ...selectOptions,
            ...(selectOptions.length === 0 ? [{ label: 'No options available', value: '' }] : [])
          ]}
          className="text-gray-900"
        />
      );

    case 'dropdown':
      return (
        <DropdownParameterComponent
          parameter={parameter}
          value={String(value || '')}
          onChange={(newValue) => onChange(newValue)}
          disabled={disabled}
          groupInfo={groupInfo}
        />
      );

    case 'ticker':
      return (
        <TickerParameterComponent
          parameter={parameter}
          value={String(value || '')}
          onChange={(newValue) => onChange(newValue)}
          widgetId={widgetId}
          instanceId={instanceId}
          disabled={disabled}
          connectionUrl={connectionUrl}
          groupInfo={groupInfo}
        />
      );

    case 'date':
      return (
        <DatePickerParameterComponent
          parameter={parameter}
          value={String(value || '')}
          onChange={handleDateChange}
          disabled={disabled}
          groupInfo={groupInfo}
        />
      );

    case 'color':
      return (
        <Input
          type="color"
          value={String(value || '#000000')}
          onChange={handleColorChange}
          disabled={disabled}
          aria-label={parameter.label}
        />
      );

    default:
      return (
        <Input
          type="text"
          value={String(value || '')}
          onChange={handleStringChange}
          placeholder={parameter.description || parameter.label}
          disabled={disabled}
          aria-label={parameter.label}
        />
      );
  }
};

export default memo(ParameterRenderer);
