import cn from "../../utils/classnames";

interface SegmentedControlProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}
export default function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  disabled = false,
  compact = false,
  className = "",
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex max-w-full rounded-xl bg-divider p-1",
        compact ? "flex-nowrap" : "flex-wrap",
        className
      )}
    >
      {options.map((option) => (
        <button
          type="button"
          key={option.value}
          disabled={disabled}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-11 flex-1 whitespace-nowrap rounded-lg transition-colors disabled:opacity-50",
            compact ? "min-w-0 px-1 text-xs" : "px-4 text-sm",
            value === option.value
              ? "bg-surface font-semibold text-green-deep shadow-sm"
              : "text-muted hover:text-ink"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
