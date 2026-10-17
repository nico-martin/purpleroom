import { useId } from "react";
import type { ReactNode } from "react";

import cn from "../../utils/classnames";
import FieldContext from "./fieldContext";

interface FieldProps {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}
export default function Field({
  label,
  hint,
  children,
  className = "",
}: FieldProps) {
  const id = useId();
  return (
    <FieldContext.Provider
      value={{ id, hintId: hint ? `${id}-hint` : undefined }}
    >
      <div className={cn("flex flex-col gap-2 text-sm", className)}>
        <label htmlFor={id} className="font-semibold">
          {label}
        </label>
        {children}
        {hint && (
          <span
            id={`${id}-hint`}
            className="text-xs leading-relaxed text-muted"
          >
            {hint}
          </span>
        )}
      </div>
    </FieldContext.Provider>
  );
}
