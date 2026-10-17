import type { HTMLAttributes } from "react";

import cn from "../../utils/classnames";

interface ListRowProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}
export default function ListRow({
  className = "",
  children,
  ...props
}: ListRowProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-4 border-b border-divider p-5 last:border-b-0 sm:px-6",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
