import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface ParameterGroupingBadgeProps {
  groupNumber: number;
  groupName?: string;
  description?: string;
  widgetIds?: string[];
  paramName?: string;
}

const ParameterGroupingBadge: React.FC<ParameterGroupingBadgeProps> = ({
  groupNumber,
  groupName,
  description,
  widgetIds,
  paramName,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);
  const badgeRef = useRef<HTMLButtonElement>(null);

  const updateTooltipPosition = useCallback(() => {
    if (badgeRef.current && isHovered) {
      const rect = badgeRef.current.getBoundingClientRect();
      setTooltipPos({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [isHovered]);

  React.useEffect(() => {
    updateTooltipPosition();
  }, [isHovered, updateTooltipPosition]);

  return (
    <>
      <button
        ref={badgeRef}
        type="button"
        className="_group-dropdown-trigger w-full h-full flex items-center justify-center"
        onMouseEnter={() => {
          setIsHovered(true);
        }}
        onMouseLeave={() => {
          setIsHovered(false);
        }}
        aria-label={`Parameter Group ${groupNumber}`}
      >
        <span
          className="w-4 h-4 rounded-[2px] text-xs flex justify-center items-center font-bold text-light-800"
          style={{ backgroundColor: '#00AAFF' }}
        >
          {groupNumber}
        </span>
      </button>

      {isHovered && tooltipPos && createPortal(
        <div
          className="fixed z-[9999] bg-white dark:bg-dark-800 rounded-md shadow-lg border border-gray-200 dark:border-dark-600 px-3 py-2 min-w-[180px]"
          style={{
            top: `${tooltipPos.top}px`,
            left: `${tooltipPos.left}px`,
            maxWidth: '300px',
          }}
        >
          <div className="text-xs font-semibold text-gray-900 dark:text-white mb-1.5">
            {groupName || `Group ${groupNumber}`}
          </div>

          {paramName && (
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
              <span className="font-medium">Parameter:</span> {paramName}
            </div>
          )}

          {description && (
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">
              <span className="font-medium">Description:</span> {description}
            </div>
          )}

          {widgetIds && widgetIds.length > 0 && (
            <div className="text-xs text-gray-600 dark:text-gray-400">
              <span className="font-medium">Widgets:</span> {widgetIds.length}
              {widgetIds.length <= 3 && (
                <div className="mt-0.5 flex flex-wrap gap-1">
                  {widgetIds.slice(0, 3).map((id) => (
                    <span
                      key={id}
                      className="px-1.5 py-0.5 bg-gray-100 dark:bg-dark-700 rounded text-[10px] text-gray-700 dark:text-gray-300"
                    >
                      {id}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  );
};

export default ParameterGroupingBadge;
