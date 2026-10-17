import type { HTMLAttributes } from "react";

import cn from "../../utils/classnames";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?:
    | "neutral"
    | "positive"
    | "urgent"
    | "soon"
    | "info"
    | "declined"
    | "solid"
    | "ink";
  mono?: boolean;
}
export default function Badge({
  tone = "neutral",
  mono = false,
  className = "",
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        {
          "bg-divider text-ink-soft": tone === "neutral",
          "bg-green-soft text-green-deep": tone === "positive",
          "bg-urgent text-urgent-ink": tone === "urgent",
          "bg-soon text-soon-ink": tone === "soon",
          "bg-info text-info-ink": tone === "info",
          "bg-declined text-declined-ink": tone === "declined",
          "bg-green text-surface": tone === "solid",
          "bg-ink text-surface": tone === "ink",
          "font-mono": mono,
        },
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
