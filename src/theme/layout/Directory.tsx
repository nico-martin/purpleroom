import type { ReactNode } from "react";

import { Card } from "../index";

interface DirectoryProps {
  label: string;
  columns: readonly [string, string, string];
  children: ReactNode;
  className?: string;
}

export default function Directory({
  label,
  columns,
  children,
  className = "",
}: DirectoryProps) {
  return (
    <Card className={className}>
      <div
        aria-hidden="true"
        className="hidden grid-cols-12 gap-6 border-b border-divider bg-ground/50 px-6 py-3 font-mono text-xs uppercase tracking-wider text-muted lg:grid"
      >
        <span className="col-span-5">{columns[0]}</span>
        <span className="col-span-3">{columns[1]}</span>
        <span className="col-span-4">{columns[2]}</span>
      </div>
      <ul aria-label={label} className="divide-y divide-divider">
        {children}
      </ul>
    </Card>
  );
}
