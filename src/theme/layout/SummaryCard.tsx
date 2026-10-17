import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import cn from "../../utils/classnames";
import { Card } from "../index";

interface SummaryCardProps {
  title: string;
  to: string;
  subtitle?: string;
  children?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export default function SummaryCard({
  title,
  to,
  subtitle,
  children,
  footer,
  className = "",
}: SummaryCardProps) {
  return (
    <Card className={cn("flex h-full min-w-0 flex-col p-4", className)}>
      <h2>
        <Link
          to={to}
          title={title}
          aria-label={title}
          className="group flex min-h-11 items-start justify-between gap-3 hover:text-green"
        >
          <span className="min-w-0">
            <span className="line-clamp-2 break-words font-heading text-lg font-semibold leading-snug">
              {title}
            </span>
            {subtitle && (
              <span className="mt-1 block truncate text-xs font-normal text-muted">
                {subtitle}
              </span>
            )}
          </span>
          <ArrowRight
            aria-hidden="true"
            size={16}
            className="mt-1.5 shrink-0 text-muted group-hover:text-green"
          />
        </Link>
      </h2>
      {children && <div className="mt-3 min-w-0 flex-1">{children}</div>}
      {footer && (
        <div className="mt-3 border-t border-divider pt-3">{footer}</div>
      )}
    </Card>
  );
}
