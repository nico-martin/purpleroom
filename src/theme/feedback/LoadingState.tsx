import { LoaderCircle } from "lucide-react";

import cn from "../../utils/classnames";

interface LoadingStateProps {
  className?: string;
}
export default function LoadingState({ className = "" }: LoadingStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-center justify-center gap-3 py-20 text-sm text-muted",
        className
      )}
    >
      <LoaderCircle size={20} className="animate-spin" />
      Getting the room ready…
    </div>
  );
}
