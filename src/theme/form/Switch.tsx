import type { ButtonHTMLAttributes } from "react";

import cn from "../../utils/classnames";

interface SwitchProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange" | "onClick" | "children"
> {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export default function Switch({
  label,
  checked,
  onChange,
  className = "",
  ...props
}: SwitchProps) {
  return (
    <button
      {...props}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-lg text-left text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors motion-reduce:transition-none",
          checked ? "bg-green" : "bg-field"
        )}
      >
        <span
          className={cn(
            "block size-5 rounded-full shadow-sm transition-transform motion-reduce:transition-none",
            checked ? "translate-x-5 bg-on-purple" : "translate-x-0 bg-surface"
          )}
        />
      </span>
      <span>{label}</span>
    </button>
  );
}
