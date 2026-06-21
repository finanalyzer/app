import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { WidgetParameter, ParameterOption, Group } from '../../../types/widgets';
import { parameterService } from '../../../services/parameters/parameterService';
import ParameterGroupingBadge from './ParameterGroupingBadge';

interface TickerParameterComponentProps {
  parameter: WidgetParameter;
  value: string;
  onChange: (value: string) => void;
  widgetId: string;
  instanceId: string;
  disabled?: boolean;
  connectionUrl?: string;
  groupInfo?: Group;
}

const RECENT_TICKERS_KEY = 'finanalyzer_recent_tickers';
const MAX_RECENT = 5;

function getRecentTickers(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_TICKERS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentTicker(ticker: string) {
  if (!ticker.trim()) return;
  const recent = getRecentTickers().filter(t => t !== ticker);
  recent.unshift(ticker);
  localStorage.setItem(RECENT_TICKERS_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

const TickerParameterComponent: React.FC<TickerParameterComponentProps> = ({
  parameter,
  value,
  onChange,
  widgetId,
  instanceId,
  disabled = false,
  connectionUrl,
  groupInfo,
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [isOpen, setIsOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<ParameterOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [dropdownPos, setDropdownPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const updateDropdownPosition = useCallback(() => {
    if (inputRef.current && isOpen) {
      const rect = inputRef.current.getBoundingClientRect();
      const popupW = Math.max(rect.width, 280);
      const left = Math.min(rect.left, window.innerWidth - popupW - 8);
      setDropdownPos({
        top: rect.bottom + 2,
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
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchTickers = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const results = await parameterService.searchTickers({
          query,
          widgetId,
          instanceId,
          baseUrl: connectionUrl || undefined,
          paramName: parameter.name || parameter.paramName || 'symbol',
        });
        setSearchResults(results);
      } catch (err) {
        console.error('Error searching tickers:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [widgetId, instanceId, connectionUrl, parameter.name, parameter.paramName],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setInputValue(newValue);
      setFocusedIndex(-1);

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        searchTickers(newValue);
      }, 300);
    },
    [searchTickers],
  );

  const handleSelectTicker = useCallback(
    (option: ParameterOption) => {
      const tickerValue = String(option.value);
      addRecentTicker(tickerValue);
      setInputValue(tickerValue);
      onChange(tickerValue);
      setIsOpen(false);
      setSearchResults([]);
    },
    [onChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const recentTickers = getRecentTickers();
      const totalItems = searchResults.length + (recentTickers.length > 0 ? recentTickers.length : 0);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex(prev => (prev + 1) % Math.max(totalItems, 1));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex(prev => (prev <= 0 ? totalItems - 1 : prev - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (focusedIndex >= 0) {
            const recentCount = recentTickers.length;
            if (focusedIndex < recentCount && recentCount > 0) {
              const recentItem = recentTickers[focusedIndex];
              addRecentTicker(recentItem);
              setInputValue(recentItem);
              onChange(recentItem);
            } else if (searchResults.length > 0) {
              const resultIndex = focusedIndex - recentCount;
              if (resultIndex >= 0 && resultIndex < searchResults.length) {
                handleSelectTicker(searchResults[resultIndex]);
              }
            }
            setIsOpen(false);
          } else {
            onChange(inputValue);
            addRecentTicker(inputValue);
            setIsOpen(false);
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          break;
        case ',':
          if (inputValue.trim()) {
            onChange(inputValue);
          }
          break;
      }
    },
    [focusedIndex, searchResults, handleSelectTicker, onChange, inputValue],
  );

  const handleFocus = useCallback(() => {
    setIsOpen(true);
    setFocusedIndex(-1);
    if (!inputValue.trim()) {
      searchTickers('');
    }
  }, [inputValue, searchTickers]);

  const handleBlur = useCallback(() => {
    setTimeout(() => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(document.activeElement) &&
        inputRef.current &&
        !inputRef.current.contains(document.activeElement)
      ) {
        if (inputValue !== value) {
          onChange(inputValue);
          if (inputValue.trim()) {
            addRecentTicker(inputValue.trim());
          }
        }
        setIsOpen(false);
      }
    }, 150);
  }, [inputValue, value, onChange]);

  const handleButtonClick = useCallback(() => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (!isOpen) {
        inputRef.current?.focus();
      }
    }
  }, [isOpen, disabled]);

  const recentTickers = useMemo(() => getRecentTickers(), [isOpen]);

  const showDropdown = isOpen && !disabled;

  const groupNumber = groupInfo ? parseInt(groupInfo.name.replace('Group ', '')) || 1 : null;

  const dropdownEl =
    showDropdown && dropdownPos ? (
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
        {isSearching && (
          <div className="flex items-center justify-center py-3">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}

        {!isSearching && (
          <>
            {recentTickers.length > 0 && !inputValue.trim() && (
              <div>
                <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 dark:text-dark-400 uppercase tracking-wider">
                  Recent
                </div>
                {recentTickers.map((ticker, index) => (
                  <div
                    key={`recent-${ticker}`}
                    className={`w-full px-2 py-1.5 rounded cursor-pointer text-left text-xs flex items-center transition-colors ${
                      focusedIndex === index
                        ? 'bg-[#CCDEEE] dark:bg-[#36363F]'
                        : 'hover:bg-[#CCDEEE] dark:hover:bg-[#36363F]'
                    } text-gray-900 dark:text-white`}
                    onClick={() => {
                      addRecentTicker(ticker);
                      setInputValue(ticker);
                      onChange(ticker);
                      setIsOpen(false);
                    }}
                    onMouseEnter={() => setFocusedIndex(index)}
                  >
                    <span className="font-medium">{ticker}</span>
                  </div>
                ))}
              </div>
            )}

            {searchResults.length > 0 && (
              <div>
                {recentTickers.length > 0 && !inputValue.trim() && (
                  <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 dark:text-dark-400 uppercase tracking-wider border-t border-gray-100 dark:border-dark-700">
                    Top Results
                  </div>
                )}
                {recentTickers.length === 0 && (
                  <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 dark:text-dark-400 uppercase tracking-wider">
                    Results
                  </div>
                )}
                {searchResults.map((option, index) => {
                  const adjustedIndex = recentTickers.length > 0 && !inputValue.trim()
                    ? recentTickers.length + index
                    : index;
                  return (
                    <div
                      key={String(option.value)}
                      className={`w-full whitespace-nowrap px-2 py-1.5 rounded cursor-pointer text-left text-xs flex items-center gap-2 transition-colors ${
                        focusedIndex === adjustedIndex
                          ? 'bg-[#CCDEEE] dark:bg-[#36363F]'
                          : 'hover:bg-[#CCDEEE] dark:hover:bg-[#36363F]'
                      } text-gray-900 dark:text-white`}
                      onClick={() => handleSelectTicker(option)}
                      onMouseEnter={() => setFocusedIndex(adjustedIndex)}
                    >
                      <span className="truncate">{option.label}</span>
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
                  );
                })}
              </div>
            )}

            {!isSearching && inputValue.trim() && searchResults.length === 0 && (
              <div className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 text-center">
                No matching tickers found
              </div>
            )}

            {!isSearching && !inputValue.trim() && recentTickers.length === 0 && (
              <div className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 text-center">
                Type to search for tickers
              </div>
            )}
          </>
        )}
      </div>
    ) : null;

  return (
    <div ref={containerRef} className="obb-parameter flex items-center justify-between gap-1 h-[20px]">
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
        type="button"
        onClick={handleButtonClick}
        disabled={disabled}
        className="flex items-center justify-between gap-1 cursor-pointer h-[20px] text-xs _select-ticker"
      >
        <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={parameter.description || parameter.label || 'Search ticker...'}
            className="bg-transparent dark:bg-transparent px-0 h-[18.8px]! border-none! w-auto min-w-[6ch] max-w-[9ch] text-xs text-grey-900 dark:text-grey-100 placeholder:text-grey-500 dark:placeholder:text-grey-400 focus:outline-none"
          />
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

export default TickerParameterComponent;
