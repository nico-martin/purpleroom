import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";

import cn from "../../utils/classnames";

interface NavItemProps {
  to: string;
  children: ReactNode;
  icon: ReactNode;
  end?: boolean;
  className?: string;
}
export default function NavItem({
  to,
  children,
  icon,
  end = false,
  className = "",
}: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
          isActive
            ? "bg-green-soft font-semibold text-green-deep"
            : "text-muted hover:bg-divider hover:text-ink",
          className
        )
      }
    >
      {icon}
      <span>{children}</span>
    </NavLink>
  );
}
