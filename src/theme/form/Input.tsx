import type { InputHTMLAttributes } from "react";
import { useContext } from "react";

import cn from "../../utils/classnames";
import FieldContext from "./fieldContext";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  className?: string;
}
export default function Input({ className = "", ...props }: InputProps) {
  const { id, hintId } = useContext(FieldContext);
  return (
    <input
      id={id}
      aria-describedby={hintId}
      className={cn(
        "min-h-11 w-full rounded-xl border border-field bg-surface px-3 py-2.5 text-sm text-ink placeholder:text-muted/70 focus:border-green focus:outline-green disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}
