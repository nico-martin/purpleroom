import type { SelectHTMLAttributes } from "react";
import { useContext } from "react";

import cn from "../../utils/classnames";
import FieldContext from "./fieldContext";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  className?: string;
}
export default function Select({
  className = "",
  children,
  ...props
}: SelectProps) {
  const { id, hintId } = useContext(FieldContext);
  return (
    <select
      id={id}
      aria-describedby={hintId}
      className={cn(
        "min-h-11 w-full rounded-xl border border-field bg-surface px-3 py-2.5 text-sm",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
