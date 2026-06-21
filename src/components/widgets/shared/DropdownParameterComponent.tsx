import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { WidgetParameter, Group } from '../../../types/widgets';
import ParameterGroupingBadge from './ParameterGroupingBadge';

interface DropdownParameterComponentProps {
  parameter: WidgetParameter;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  groupInfo?: Group;
}

const DropdownParameterComponent: React.FC<DropdownParameterComponentProps> = ({
  parameter,
  value,
  onChange,
  disabled = false,
  groupInfo,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedOptionIndex, setFocusedOptionIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedValues, setSelectedValues] = useState<Set<string>>(new Set());
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const multiSelect = parameter.multiSelect ?? false;
  const popupWidth = parameter.style?.popupWidth;

  const options = useMemo(() => {
    return (parameter.options || []).map((opt) => ({
      value: String(opt.value),
      label: opt.label,
    }));
  }, [parameter.options]);

  useEffect(() => {
    if (multiSelect && value) {
      setSelectedValues(
        new Set(
          value
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean),
        ),
      );
    }
  }, [value, multiSelect]);

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

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter((opt) => opt.label.toLowerCase().includes(query));
  }, [options, searchQuery]);

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
      const values = value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      if (values.length === 0) return parameter.label || 'Select options';
      if (values.length === 1) {
        const opt = options.find((o) => o.value === values[0]);
        return opt?.label || values[0];
      }
      return `${values.length} selected`;
    }
    const selected = options.find((opt) => opt.value === value);
    return selected?.label || parameter.label || value;
  };

  const isSelected = (optionValue: string): boolean => {
    if (multiSelect) return selectedValues.has(optionValue);
    return value === optionValue;
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
        setFocusedOptionIndex((prev) =>
          (prev + 1) % Math.max(filteredOptions.length, 1),
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedOptionIndex((prev) =>
          prev === 0 ? Math.max(filteredOptions.length - 1, 0) : prev - 1,
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredOptions[focusedOptionIndex]) {
          handleSelect(filteredOptions[focusedOptionIndex].value);
          if (!multiSelect) {
            setIsOpen(false);
          }
        }
        break;
    }
  };

  const groupNumber = groupInfo ? parseInt(groupInfo.name.replace('Group ', '')) || 1 : null;

  const dropdownEl =
    isOpen && !disabled && dropdownPos ? (
      <div
        ref={dropdownRef}
        className="fixed z-[9999] bg-white dark:bg-dark-800 rounded-md overflow-hidden"
        style={{
          top: `${dropdownPos.top}px`,
          left: `${dropdownPos.left}px`,
          width: `${dropdownPos.width}px`,
          maxWidth: '90vw',
          maxHeight: '400px',
          boxShadow: 'rgba(0, 0, 0, 0.25) 0px 4px 8px 0px',
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
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setFocusedOptionIndex(0);
              }}
              onKeyDown={handleKeyDown}
            />
          </div>
        )}

        <div className="overflow-y-auto overflow-x-hidden" style={{ maxHeight: options.length > 5 ? '300px' : '400px' }}>
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <div
                key={option.value}
                className={`w-full whitespace-nowrap p-1 rounded cursor-pointer text-left text-xs flex justify-between items-center gap-2 transition-colors ${
                  index === focusedOptionIndex
                    ? 'bg-[#CCDEEE] dark:bg-[#36363F]'
                    : 'hover:bg-[#CCDEEE] dark:hover:bg-[#36363F]'
                } text-gray-900 dark:text-white`}
                onClick={() => handleSelect(option.value)}
                onMouseEnter={() => setFocusedOptionIndex(index)}
              >
                <span className="truncate">{option.label}</span>
                {isSelected(option.value) && (
                  <svg
                    className="min-w-3 min-h-3 h-3 w-3 flex-shrink-0 text-blue-600 dark:text-blue-400"
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
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 text-center">
              {searchQuery ? 'No matching options' : 'No options available'}
            </div>
          )}
        </div>
      </div>
    ) : null;

  return (
    <div className="obb-parameter flex items-center justify-between gap-1 h-[20px]">
      {groupNumber !== null && (
        <div className="flex-shrink-0">
          <ParameterGroupingBadge
            groupNumber={groupNumber}
            groupName={groupInfo?.name}
            description={groupInfo?.description}
            widgetIds={groupInfo?.widgetIds}
            paramName={groupInfo?.paramName}
          />
        </div>
      )}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        onKeyDown={handleKeyDown}
        className="flex items-center justify-between gap-1 h-[20px] text-xs cursor-pointer text-gray-900 dark:text-white disabled:opacity-50"
      >
        <span className="truncate">{getDisplayLabel()}</span>
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`h-3 w-3 transition-transform flex-shrink-0 ${isOpen ? 'rotate-180' : ''}`}
        >
          <path
            d="m6 9 6 6 6-6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      {dropdownEl && createPortal(dropdownEl, document.body)}
    </div>
  );
};

export default DropdownParameterComponent;
