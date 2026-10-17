import type { ComponentProps } from "react";
import { Link } from "react-router-dom";

import cn from "../../utils/classnames";

interface ButtonLinkProps extends ComponentProps<typeof Link> {
  variant?: "primary" | "secondary" | "ghost" | "dashed";
}
export default function ButtonLink({
  variant = "secondary",
  className = "",
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors",
        {
          "border border-green bg-green text-surface hover:bg-green-deep":
            variant === "primary",
          "border border-field bg-surface hover:bg-ground":
            variant === "secondary",
          "text-muted hover:bg-divider": variant === "ghost",
          "border border-dashed border-field text-green hover:bg-green-soft":
            variant === "dashed",
        },
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
}
