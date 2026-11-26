import { SUBMISSION_STATUS_LABELS } from "../../lib/constants";
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
  other_talk_chosen: "solid",
  attended: "ink",
} as const;
export default function StatusChip({
  status,
  className = "",
}: StatusChipProps) {
  return (
    <Badge tone={tones[status]} className={className}>
      {SUBMISSION_STATUS_LABELS[status]}
    </Badge>
  );
}
