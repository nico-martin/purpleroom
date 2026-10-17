import type { HTMLAttributes } from "react";

import cn from "../../utils/classnames";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}
export default function Card({
  padded = false,
  className = "",
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border border-border bg-surface",
        padded && "p-5 sm:p-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
