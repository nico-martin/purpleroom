import type { SubmissionStatus } from "../../types";
import { Badge } from "../index";

interface StatusChipProps {
  status: SubmissionStatus;
  className?: string;
}
const tones = {
  interested: "neutral",
  submitted: "info",
  accepted: "positive",
  rejected: "declined",
  waitlisted: "soon",
  confirmed: "solid",
  declined: "declined",
  attended: "ink",
} as const;
export default function StatusChip({
  status,
  className = "",
}: StatusChipProps) {
  return (
    <Badge tone={tones[status]} className={className}>
      {status[0].toUpperCase() + status.slice(1)}
    </Badge>
  );
}
