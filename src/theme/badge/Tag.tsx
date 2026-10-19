import cn from "../../utils/classnames";

interface TagProps {
  children: import("react").ReactNode;
  count?: number;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}
export default function Tag({
  children,
  count,
  selected = false,
  onClick,
  className = "",
}: TagProps) {
  const classes = cn(
    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs",
    selected
      ? "border-green bg-green text-on-purple"
      : "border-border bg-green-soft text-green-deep",
    onClick && "min-h-11",
    className
  );
  const content = (
    <>
      {children}
      {count !== undefined && <span className="font-mono">{count}</span>}
    </>
  );
  return onClick ? (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      aria-pressed={selected}
    >
      {content}
    </button>
  ) : (
    <span className={classes}>{content}</span>
  );
}
