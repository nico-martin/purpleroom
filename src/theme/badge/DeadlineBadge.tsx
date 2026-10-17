import { Badge } from "../index";

interface DeadlineBadgeProps {
  days: number;
  className?: string;
}
export default function DeadlineBadge({
  days,
  className = "",
}: DeadlineBadgeProps) {
  return (
    <Badge
      mono
      tone={
        days < 0
          ? "neutral"
          : days <= 7
            ? "urgent"
            : days <= 21
              ? "soon"
              : "neutral"
      }
      className={className}
    >
      {days < 0
        ? "Closed"
        : days === 0
          ? "Today"
          : `${days} ${days === 1 ? "day" : "days"}`}
    </Badge>
  );
}
