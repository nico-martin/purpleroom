import type { ReactNode } from "react";

import cn from "../../utils/classnames";

interface PageHeaderProps {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}
export default function PageHeader({
  title,
  eyebrow,
  description,
  action,
  className = "",
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "mb-9 flex flex-wrap items-end justify-between gap-5",
        className
      )}
    >
      <div>
        {eyebrow && (
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-muted">
            {eyebrow}
          </p>
        )}
        <h1 className="font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm leading-relaxed text-muted">
            {description}
          </p>
        )}
      </div>
      {action}
    </header>
  );
}
