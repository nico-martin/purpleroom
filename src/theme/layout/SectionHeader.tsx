import type { ReactNode } from "react";

import cn from "../../utils/classnames";

interface SectionHeaderProps {
  title: string;
  count?: number;
  description?: string;
  action?: ReactNode;
  className?: string;
}
export default function SectionHeader({
  title,
  count,
  description,
  action,
  className = "",
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-wrap items-center justify-between gap-3",
        className
      )}
    >
      <div>
        <h2 className="flex items-center gap-3 text-xl">
          {title}
          {count !== undefined && (
            <span className="rounded-md bg-divider px-2 py-0.5 font-mono text-xs text-muted">
              {count}
            </span>
          )}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-muted">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
