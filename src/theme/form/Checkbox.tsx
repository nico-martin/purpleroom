import type { InputHTMLAttributes } from "react";

import cn from "../../utils/classnames";

interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "type"
> {
  label: string;
}
export default function Checkbox({
  label,
  className = "",
  ...props
}: CheckboxProps) {
  return (
    <label
      className={cn(
        "flex min-h-11 cursor-pointer items-center gap-3 text-sm",
        className
      )}
    >
      <input
        type="checkbox"
        className="size-4 shrink-0 accent-green"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
