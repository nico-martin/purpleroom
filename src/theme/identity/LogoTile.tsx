import { useState } from "react";

import { initials, nameColor } from "../../lib/format";
import cn from "../../utils/classnames";

interface LogoTileProps {
  name: string;
  src?: string | null;
  size?: "md" | "lg";
  className?: string;
}
const colors = [
  "bg-spotlight text-green-deep",
  "bg-green-soft text-green-deep",
  "bg-info text-info-ink",
  "bg-declined text-declined-ink",
];
export default function LogoTile({
  name,
  src,
  size = "md",
  className = "",
}: LogoTileProps) {
  const [failed, setFailed] = useState(false);
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-xl font-heading font-semibold",
        colors[nameColor(name)],
        size === "lg" ? "size-20 text-2xl" : "size-12 text-base",
        className
      )}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          className="size-full object-contain"
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
        />
      ) : initials(name).length === 1 ? (
        name.slice(0, 2).toUpperCase()
      ) : (
        initials(name)
      )}
    </div>
  );
}
