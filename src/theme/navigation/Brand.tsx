import { DoorOpen } from "lucide-react";
import { Link } from "react-router-dom";

import cn from "../../utils/classnames";

interface BrandProps {
  className?: string;
}
export default function Brand({ className = "" }: BrandProps) {
  return (
    <Link to="/" className={cn("inline-flex items-center gap-3", className)}>
      <span className="flex size-10 items-center justify-center rounded-xl bg-green text-surface">
        <DoorOpen size={24} strokeWidth={1.6} />
      </span>
      <span className="font-heading text-xl font-semibold tracking-tight">
        Green Room<span className="ml-0.5 text-green">.</span>
      </span>
    </Link>
  );
}
