import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { WidgetParameter, Group } from '../../../types/widgets';
import { format, parse, isValid, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import ParameterGroupingBadge from './ParameterGroupingBadge';

interface DatePickerParameterComponentProps {
  parameter: WidgetParameter;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  groupInfo?: Group;
}

function resolveDateModifier(raw: string, targetFormat = 'yyyy-MM-dd'): string {
  if (!raw) return raw;
  const trimmed = raw.trim();
  if (!trimmed.startsWith('$currentDate')) return trimmed;

  const now = new Date();
  const daysMatch = trimmed.match(/\$currentDate([+-]\d+)d/);
  if (daysMatch) {
    const offset = parseInt(daysMatch[1], 10);
    now.setDate(now.getDate() + offset);
  }
  return format(now, targetFormat);
}

function formatDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const resolved = resolveDateModifier(dateStr);
  try {
    const d = parse(resolved, 'yyyy-MM-dd', new Date());
    if (isValid(d)) {
      return format(d, 'MMM dd, yyyy');
    }
  } catch {
    // fall through
  }
  return dateStr;
}

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const DatePickerParameterComponent: React.FC<DatePickerParameterComponentProps> = ({
  parameter,
  value,
  onChange,
  disabled = false,
  groupInfo,
}) => {
  const resolvedValue = useMemo(() => resolveDateModifier(value), [value]);

  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => {
    const d = parse(resolvedValue, 'yyyy-MM-dd', new Date());
    return isValid(d) ? d : new Date();
  });
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const d = parse(resolvedValue, 'yyyy-MM-dd', new Date());
    if (isValid(d)) {
      setViewDate(d);
    }
  }, [resolvedValue]);

  const updateDropdownPosition = useCallback(() => {
    if (buttonRef.current && isOpen) {
      const rect = buttonRef.current.getBoundingClientRect();
      const popupW = 250;
      const left = Math.min(rect.left, window.innerWidth - popupW - 8);
      setDropdownPos({
        top: rect.bottom + 4,
        left: Math.max(left, 4),
        width: popupW,
      });
    }
  }, [isOpen]);

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
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewDate);
    const monthEnd = endOfMonth(viewDate);
    const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calStart, end: calEnd });
  }, [viewDate]);

  const selectedDate = useMemo(() => {
    const d = parse(resolvedValue, 'yyyy-MM-dd', new Date());
    return isValid(d) ? d : null;
  }, [resolvedValue]);

  const handleDayClick = (day: Date) => {
    const formatted = format(day, 'yyyy-MM-dd');
    onChange(formatted);
    setIsOpen(false);
  };

  const goToPrevMonth = () => setViewDate((d: Date) => subMonths(d, 1));
  const goToNextMonth = () => setViewDate((d: Date) => addMonths(d, 1));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      buttonRef.current?.focus();
    }
  };

  const displayLabel = resolvedValue ? formatDisplay(resolvedValue) : (parameter.label || 'Select Date');
  const today = new Date();

  const groupNumber = groupInfo ? parseInt(groupInfo.name.replace('Group ', '')) || 1 : null;

  const calendarEl =
    isOpen && !disabled && dropdownPos ? (
      <div
        ref={dropdownRef}
        className="fixed z-[9999] bg-white dark:bg-dark-800 rounded-md overflow-hidden"
        style={{
          top: `${dropdownPos.top}px`,
          left: `${dropdownPos.left}px`,
          width: `${dropdownPos.width}px`,
          maxWidth: '90vw',
          boxShadow: 'rgba(0, 0, 0, 0.25) 0px 4px 8px 0px',
        }}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-dark-600">
          <button
            type="button"
            onClick={goToPrevMonth}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-600 dark:text-gray-300"
            aria-label="Previous month"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <span className="text-xs font-medium text-gray-900 dark:text-white">
            {format(viewDate, 'MMMM yyyy')}
          </span>
          <button
            type="button"
            onClick={goToNextMonth}
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-dark-700 text-gray-600 dark:text-gray-300"
            aria-label="Next month"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>

        <div className="grid grid-cols-7 px-2 pt-2">
          {DAYS_OF_WEEK.map((d) => (
            <div key={d} className="text-center text-2xs text-gray-400 dark:text-gray-500 py-1">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 px-2 pb-2">
          {calendarDays.map((day, i) => {
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, viewDate);
            const isToday = isSameDay(day, today);

            return (
              <button
                key={i}
                type="button"
                onClick={() => handleDayClick(day)}
                disabled={!isCurrentMonth}
                className={`
                  w-8 h-8 text-xs rounded-sm flex items-center justify-center mx-auto my-0.5
                  ${isCurrentMonth ? 'cursor-pointer text-gray-900 dark:text-white hover:bg-[#CCDEEE] dark:hover:bg-[#36363F]' : 'cursor-default text-gray-300 dark:text-gray-600'}
                  ${isSelected ? '!bg-blue-600 !text-white hover:!bg-blue-700' : ''}
                  ${isToday && !isSelected ? 'font-bold text-blue-600 dark:text-blue-400' : ''}
                `}
              >
                {day.getDate()}
              </button>
            );
          })}
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
        id="date"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className="BB-Button ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 disabled:pointer-events-none disabled:[&_svg]:opacity-50 transition cursor-pointer text-general-label hover:border-btn-outlined-border-hover focus-visible:ring-alert-informative disabled:border-btn-outlined-border-disabled disabled:text-general-label-disabled data-[loading=true]:border-btn-outlined-border data-[loading=true]:text-general-label data-[loading=true]:cursor-default body-xs-medium rounded-sm [&_.BB-Icon]:size-3 flex whitespace-nowrap items-center justify-between px-0.5 gap-0.5 h-[20px] text-xs !border-0"
        data-loading={disabled ? 'true' : 'false'}
      >
        <span>{displayLabel}</span>
        <svg
          width="15"
          height="15"
          viewBox="0 0 15 15"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="ml-2 h-4 w-4"
        >
          <path
            d="M4.5 1C4.77614 1 5 1.22386 5 1.5V2H10V1.5C10 1.22386 10.2239 1 10.5 1C10.7761 1 11 1.22386 11 1.5V2H12.5C13.3284 2 14 2.67157 14 3.5V12.5C14 13.3284 13.3284 14 12.5 14H2.5C1.67157 14 1 13.3284 1 12.5V3.5C1 2.67157 1.67157 2 2.5 2H4V1.5C4 1.22386 4.22386 1 4.5 1ZM10 3V3.5C10 3.77614 10.2239 4 10.5 4C10.7761 4 11 3.77614 11 3.5V3H12.5C12.7761 3 13 3.22386 13 3.5V5H2V3.5C2 3.22386 2.22386 3 2.5 3H4V3.5C4 3.77614 4.22386 4 4.5 4C4.77614 4 5 3.77614 5 3.5V3H10ZM2 6V12.5C2 12.7761 2.22386 13 2.5 13H12.5C12.7761 13 13 12.7761 13 12.5V6H2ZM7 7.5C7 7.22386 7.22386 7 7.5 7C7.77614 7 8 7.22386 8 7.5C8 7.77614 7.77614 8 7.5 8C7.22386 8 7 7.77614 7 7.5ZM9.5 7C9.22386 7 9 7.22386 9 7.5C9 7.77614 9.22386 8 9.5 8C9.77614 8 10 7.77614 10 7.5C10 7.22386 9.77614 7 9.5 7ZM11 7.5C11 7.22386 11.2239 7 11.5 7C11.7761 7 12 7.22386 12 7.5C12 7.77614 11.7761 8 11.5 8C11.2239 8 11 7.77614 11 7.5ZM11.5 9C11.2239 9 11 9.22386 11 9.5C11 9.77614 11.2239 10 11.5 10C11.7761 10 12 9.77614 12 9.5C12 9.22386 11.7761 9 11.5 9ZM9 9.5C9 9.22386 9.22386 9 9.5 9C9.77614 9 10 9.22386 10 9.5C10 9.77614 9.77614 10 9.5 10C9.22386 10 9 9.77614 9 9.5ZM7.5 9C7.22386 9 7 9.22386 7 9.5C7 9.77614 7.22386 10 7.5 10C7.77614 10 8 9.77614 8 9.5C8 9.22386 7.77614 9 7.5 9ZM5 9.5C5 9.22386 5.22386 9 5.5 9C5.77614 9 6 9.22386 6 9.5C6 9.77614 5.77614 10 5.5 10C5.22386 10 5 9.77614 5 9.5ZM3.5 9C3.22386 9 3 9.22386 3 9.5C3 9.77614 3.22386 10 3.5 10C3.77614 10 4 9.77614 4 9.5C4 9.22386 3.77614 9 3.5 9ZM3 11.5C3 11.2239 3.22386 11 3.5 11C3.77614 11 4 11.2239 4 11.5C4 11.7761 3.77614 12 3.5 12C3.22386 12 3 11.7761 3 11.5ZM5.5 11C5.22386 11 5 11.2239 5 11.5C5 11.7761 5.22386 12 5.5 12C5.77614 12 6 11.7761 6 11.5C6 11.2239 5.77614 11 5.5 11ZM7 11.5C7 11.2239 7.22386 11 7.5 11C7.77614 11 8 11.2239 8 11.5C8 11.7761 7.77614 12 7.5 12C7.22386 12 7 11.7761 7 11.5ZM9.5 11C9.22386 11 9 11.2239 9 11.5C9 11.7761 9.22386 12 9.5 12C9.77614 12 10 11.7761 10 11.5C10 11.2239 9.77614 11 9.5 11Z"
            fill="currentColor"
            fillRule="evenodd"
            clipRule="evenodd"
          />
        </svg>
      </button>
      {calendarEl && createPortal(calendarEl, document.body)}
    </div>
  );
};

export default DatePickerParameterComponent;
