import type { TextareaHTMLAttributes } from "react";
import { useContext } from "react";

import cn from "../../utils/classnames";
import FieldContext from "./fieldContext";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  className?: string;
}
export default function Textarea({
  className = "",
  rows = 5,
  ...props
}: TextareaProps) {
  const { id, hintId } = useContext(FieldContext);
  return (
    <textarea
      id={id}
      aria-describedby={hintId}
      rows={rows}
      className={cn(
        "w-full resize-y rounded-xl border border-field bg-surface px-3 py-2.5 text-sm placeholder:text-muted/70 focus:border-green",
        className
      )}
      {...props}
    />
  );
}
