import { LoaderCircle } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";

import cn from "../../utils/classnames";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "dashed" | "danger";
  loading?: boolean;
  compact?: boolean;
}
export default function Button({
  variant = "secondary",
  loading = false,
  compact = false,
  className = "",
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        compact
          ? "gap-1.5 whitespace-nowrap px-2 py-2 text-xs"
          : "gap-2 px-4 py-2.5 text-sm",
        {
          "border border-green bg-green text-on-purple hover:bg-green-deep":
            variant === "primary",
          "border border-field bg-surface text-ink hover:bg-ground":
            variant === "secondary",
          "text-muted hover:bg-divider hover:text-ink": variant === "ghost",
          "border border-dashed border-field text-green hover:bg-green-soft":
            variant === "dashed",
          "border border-urgent bg-urgent text-urgent-ink hover:opacity-80":
            variant === "danger",
        },
        className
      )}
      {...props}
    >
      {loading && <LoaderCircle size={16} className="animate-spin" />}
      {children}
    </button>
  );
}
