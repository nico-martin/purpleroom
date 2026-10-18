import { useState } from "react";

import { initials, nameColor } from "../../lib/format";
import cn from "../../utils/classnames";

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}
const colors = [
  "bg-avatar-purple",
  "bg-avatar-orange",
  "bg-avatar-blue",
  "bg-green",
];
export default function Avatar({
  name,
  src,
  size = "md",
  className = "",
}: AvatarProps) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  return (
    <span
      title={name}
      aria-label={name}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white",
        colors[nameColor(name)],
        {
          "size-7 text-xs": size === "sm",
          "size-9 text-xs": size === "md",
          "size-14 text-base": size === "lg",
        },
        className
      )}
    >
      {src && failedSource !== src ? (
        <img
          src={src}
          alt={name}
          className="size-full object-cover"
          onError={() => setFailedSource(src)}
          referrerPolicy="no-referrer"
        />
      ) : (
        initials(name)
      )}
    </span>
  );
}
