interface MetricItem {
  value?: number | string;
  label?: string;
  delta?: number | string;
}

interface MetricRendererProps {
  data: unknown;
}

function MetricItemRenderer({ item }: { item: MetricItem }): JSX.Element {
  const value = item.value ?? 0;
  const label = item.label ?? "Metric";
  const delta = item.delta;

  const deltaNum = typeof delta === "string" ? parseFloat(delta) : delta;
  const isPositive = typeof deltaNum === "number" && !isNaN(deltaNum) && deltaNum >= 0;

  return (
    <div className="p-4 h-full flex flex-col justify-center">
      <div className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
        {value}
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-300 mb-2">
        {label}
      </div>
      {typeof deltaNum === "number" && !isNaN(deltaNum) && (
        <div
          className={`text-sm font-medium ${isPositive ? "text-green-500" : "text-red-500"}`}
        >
          <span className="mr-1">{isPositive ? "↑" : "↓"}</span>
          {Math.abs(deltaNum)}%
        </div>
      )}
    </div>
  );
}

export function MetricRenderer({ data }: MetricRendererProps): JSX.Element {
  const items = Array.isArray(data) ? data : [data];

  const validItems = items.map((item) => (item || {}) as MetricItem);

  if (validItems.length === 1) {
    return <MetricItemRenderer item={validItems[0]} />;
  }

  return (
    <div className="grid grid-cols-2 gap-4 p-4 h-full">
      {validItems.map((item, index) => (
        <MetricItemRenderer key={index} item={item} />
      ))}
    </div>
  );
}