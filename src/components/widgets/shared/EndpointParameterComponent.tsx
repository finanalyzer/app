import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { WidgetParameter, ParameterOption, Group } from '../../../types/widgets';
import { isEndpointParameter } from '../../../types/widgets';
import { parameterService } from '../../../services/parameters/parameterService';
import { Button, Icon } from '@openbb/ui';
import ParameterGroupingBadge from './ParameterGroupingBadge';

interface EndpointParameterComponentProps {
  parameter: WidgetParameter;
  value: string;
  onChange: (value: string) => void;
  widgetId: string;
  instanceId: string;
  disabled?: boolean;
  connectionUrl?: string;
  groupInfo?: Group;
}

const EndpointParameterComponent: React.FC<EndpointParameterComponentProps> = ({
  parameter,
  value,
  onChange,
  widgetId,
  instanceId,
  disabled = false,
  connectionUrl,
  groupInfo,
}) => {
  const [options, setOptions] = useState<ParameterOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [focusedOptionIndex, setFocusedOptionIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedValues, setSelectedValues] = useState<Set<string>>(new Set);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const multiSelect = parameter.multiSelect ?? false;
  const popupWidth = parameter.style?.popupWidth;

  useEffect(() => {
    if (multiSelect && value) {
      setSelectedValues(new Set(value.split(',').map(v => v.trim()).filter(Boolean)));
    }
  }, [value, multiSelect]);

  const fetchOptions = useCallback(async () => {
    if (disabled) return;

    setIsLoading(true);
    setError(null);

    try {
      const fetchedOptions = await parameterService.fetchParamOptions({
        parameter,
        widgetId,
        instanceId,
        baseUrl: connectionUrl || undefined,
      });
      setOptions(fetchedOptions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load options');
      console.error('Error fetching endpoint parameter options:', err);
    } finally {
      setIsLoading(false);
    }
  }, [parameter, widgetId, instanceId, disabled, connectionUrl]);

  useEffect(() => {
    if (isEndpointParameter(parameter)) {
      fetchOptions();
    }
  }, [parameter, widgetId, instanceId, disabled, fetchOptions]);

  const handleRefresh = useCallback(() => {
    fetchOptions();
  }, [fetchOptions]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter(
      opt =>
        opt.label.toLowerCase().includes(query) ||
        (opt.extraInfo?.description?.toLowerCase().includes(query) ?? false)
    );
  }, [options, searchQuery]);

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    if (isOpen) {
      setSearchQuery('');
      setFocusedOptionIndex(0);
    }
  }, [isOpen]);

  const updateDropdownPosition = useCallback(() => {
    if (buttonRef.current && isOpen) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popupW = popupWidth || Math.max(rect.width, 190);
      const left = Math.min(rect.left, window.innerWidth - popupW - 8);
      setDropdownPos({
        top: rect.bottom + 4,
        left: Math.max(left, 4),
        width: popupW,
      });
    }
  }, [isOpen, popupWidth]);

  useEffect(() => {
    updateDropdownPosition();
  }, [isOpen, updateDropdownPosition]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('scroll', updateDropdownPosition, true);
    window.addEventListener('resize', updateDropdownPosition);
    return () => {
      window.removeEventListener('scroll', updateDropdownPosition, true);
      window.removeEventListener('resize', updateDropdownPosition);
    };
  }, [isOpen, updateDropdownPosition]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (optionValue: string) => {
    if (multiSelect) {
      const newSelected = new Set(selectedValues);
      if (newSelected.has(optionValue)) {
        newSelected.delete(optionValue);
      } else {
        newSelected.add(optionValue);
      }
      setSelectedValues(newSelected);
      onChange(Array.from(newSelected).join(','));
    } else {
      onChange(optionValue);
      setIsOpen(false);
    }
  };

  const getDisplayLabel = (): string => {
    if (!value) return parameter.label || 'Select an option';

    if (multiSelect) {
      const values = value.split(',').map(v => v.trim()).filter(Boolean);
      if (values.length === 0) return parameter.label || 'Select options';
      if (values.length === 1) {
        const opt = options.find(o => String(o.value) === values[0]);
        return opt?.label || values[0];
      }
      return `${values.length} selected`;
    }

    const selected = options.find(opt => String(opt.value) === value);
    return selected?.label || value;
  };

  const isSelected = (optionValue: string): boolean => {
    if (multiSelect) {
      return selectedValues.has(optionValue);
    }
    return String(value) === optionValue;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        buttonRef.current?.focus();
        break;
      case 'ArrowDown':
        e.preventDefault();
        setFocusedOptionIndex(prev =>
          (prev + 1) % Math.max(filteredOptions.length, 1)
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedOptionIndex(prev =>
          prev === 0 ? Math.max(filteredOptions.length - 1, 0) : prev - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[focusedOptionIndex]) {
          handleSelect(String(filteredOptions[focusedOptionIndex].value));
          if (!multiSelect) {
            setIsOpen(false);
          }
        }
        break;
    }
  };

  const groupNumber = groupInfo ? parseInt(groupInfo.name.replace('Group ', '')) || 1 : null;

  if (!isEndpointParameter(parameter)) {
    return null;
  }

  const dropdownEl = isOpen && !isLoading && !disabled && dropdownPos && (
    <div
      ref={dropdownRef}
      className="fixed z-[9999] bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-md shadow-lg overflow-hidden"
      style={{
        top: `${dropdownPos.top}px`,
        left: `${dropdownPos.left}px`,
        width: `${dropdownPos.width}px`,
        maxWidth: '90vw',
      }}
    >
      {options.length > 5 && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-gray-200 dark:border-dark-600">
          <svg
            className="w-3.5 h-3.5 text-gray-400 dark:text-dark-400 flex-shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            className="flex-1 border-none bg-transparent text-xs text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-dark-400 focus:outline-none py-0.5"
            placeholder="Search"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              setFocusedOptionIndex(0);
            }}
            onKeyDown={handleKeyDown}
          />
        </div>
      )}

      <div className="max-h-[300px] overflow-y-auto overflow-x-hidden py-1">
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option, index) => (
            <div
              key={String(option.value)}
              className={`w-full whitespace-nowrap px-2 py-1.5 rounded cursor-pointer text-left text-xs flex items-center gap-2 transition-colors ${
                index === focusedOptionIndex
                  ? 'bg-[#CCDEEE] dark:bg-[#36363F]'
                  : 'hover:bg-[#CCDEEE] dark:hover:bg-[#36363F]'
              } text-gray-900 dark:text-white`}
              onClick={() => handleSelect(String(option.value))}
              onMouseEnter={() => setFocusedOptionIndex(index)}
            >
              <span className="inline-flex gap-2 items-center min-w-0 flex-shrink">
                <span className="truncate">{option.label}</span>
                {isSelected(String(option.value)) && (
                  <svg
                    className="w-3 h-3 flex-shrink-0 text-blue-600 dark:text-blue-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                )}
              </span>

              {option.extraInfo && (option.extraInfo.description || option.extraInfo.rightOfDescription) && (
                <span className="uppercase tracking-wide flex gap-1 ml-auto flex-shrink-0">
                  {option.extraInfo.description && (
                    <span className="text-gray-500 dark:text-[#8A8A90]">
                      {option.extraInfo.description}
                    </span>
                  )}
                  {option.extraInfo.rightOfDescription && (
                    <span className="text-gray-900 dark:text-white">
                      {option.extraInfo.rightOfDescription}
                    </span>
                  )}
                </span>
              )}
            </div>
          ))
        ) : (
          <div className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 text-center">
            {searchQuery ? 'No matching options' : 'No options available'}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="endpoint-parameter">
      <div className="flex items-center justify-between">
        {groupNumber !== null && (
          <div className="flex-shrink-0 mr-2">
            <ParameterGroupingBadge
              groupNumber={groupNumber}
              groupName={groupInfo?.name}
              description={groupInfo?.description}
              widgetIds={groupInfo?.widgetIds}
              paramName={groupInfo?.paramName}
            />
          </div>
        )}
        <Button
          ref={buttonRef}
          variant="ghost"
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
          disabled={isLoading || disabled}
          onKeyDown={handleKeyDown}
          className={`w-full justify-between ${
            error ? 'border-red-500 dark:border-red-400' : 'border-gray-300 dark:border-dark-600'
          } rounded-md text-left focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-dark-800 text-gray-900 dark:text-white`}
        >
          <span className="truncate">{getDisplayLabel()}</span>
          <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
            {isLoading && (
              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            )}
            {!isLoading && (
              <svg
                className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            )}
          </div>
        </Button>
        {!isLoading && !disabled && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            title="Refresh options"
            className="ml-2 p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none flex-shrink-0"
          >
            <Icon name={"refresh-cw" as never} size={16} />
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center justify-between mt-1">
          <p className="text-red-500 text-xs">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            title="Retry"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none"
          >
            <Icon name={"refresh-cw" as never} size={14} />
          </Button>
        </div>
      )}

      {dropdownEl && createPortal(dropdownEl, document.body)}
    </div>
  );
};

export default EndpointParameterComponent;
