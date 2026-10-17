import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";

import cn from "../../utils/classnames";

interface NoticeProps {
  children: ReactNode;
  tone?: "error" | "success" | "info";
  className?: string;
}
export default function Notice({
  children,
  tone = "info",
  className = "",
}: NoticeProps) {
  const Icon =
    tone === "error" ? AlertCircle : tone === "success" ? CheckCircle2 : Info;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-xl p-4 text-sm leading-relaxed",
        {
          "bg-urgent text-urgent-ink": tone === "error",
          "bg-green-soft text-green-deep": tone === "success",
          "bg-divider text-muted": tone === "info",
        },
        className
      )}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
