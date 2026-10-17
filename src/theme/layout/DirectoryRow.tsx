import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import cn from "../../utils/classnames";

interface DirectoryRowProps {
  title: string;
  to: string;
  subtitle?: string;
  secondary: ReactNode;
  detail: ReactNode;
  className?: string;
}

export default function DirectoryRow({
  title,
  to,
  subtitle,
  secondary,
  detail,
  className = "",
}: DirectoryRowProps) {
  return (
    <li
      className={cn(
        "grid grid-cols-2 items-center gap-x-6 gap-y-3 p-5 transition-colors hover:bg-ground/50 sm:px-6 lg:grid-cols-12",
        className
      )}
    >
      <div className="col-span-2 min-w-0 lg:col-span-5">
        <h2>
          <Link
            to={to}
            className="group inline-flex min-h-11 max-w-full items-center gap-3 font-heading text-lg font-semibold leading-snug hover:text-green"
          >
            <span className="min-w-0 break-words">{title}</span>
            <ArrowRight
              aria-hidden="true"
              size={16}
              className="shrink-0 text-muted transition-colors group-hover:text-green"
            />
          </Link>
        </h2>
        {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
      </div>
      <div className="min-w-0 self-start lg:col-span-3 lg:self-center">
        {secondary}
      </div>
      <div className="min-w-0 self-start lg:col-span-4 lg:self-center">
        {detail}
      </div>
    </li>
  );
}
