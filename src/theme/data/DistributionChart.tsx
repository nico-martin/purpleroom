import cn from "../../utils/classnames";

interface DistributionItem {
  label: string;
  value: number;
  colorClassName: string;
}

interface DistributionChartProps {
  label: string;
  items: DistributionItem[];
  className?: string;
}

export default function DistributionChart({
  label,
  items,
  className = "",
}: DistributionChartProps) {
  const visible = items.filter((item) => item.value > 0);
  return (
    <div className={className}>
      <div
        role="img"
        aria-label={`${label}: ${visible.map((item) => `${item.label} ${item.value}`).join(", ") || "No data"}`}
        className="flex h-3 overflow-hidden rounded-full bg-divider"
      >
        {visible.map((item) => (
          <span
            key={item.label}
            aria-hidden="true"
            className={cn("h-full", item.colorClassName)}
            style={{ flexGrow: item.value, flexBasis: 0 }}
          />
        ))}
      </div>
      <dl className="mt-4 flex flex-wrap gap-2 text-xs">
        {visible.map((item) => (
          <div
            key={item.label}
            className="inline-flex items-center gap-2 rounded-lg bg-ground px-2 py-1.5"
          >
            <dt className="flex min-w-0 items-center gap-2 text-muted">
              <span
                aria-hidden="true"
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  item.colorClassName
                )}
              />
              <span>{item.label}</span>
            </dt>
            <dd className="font-mono font-medium text-ink">{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
