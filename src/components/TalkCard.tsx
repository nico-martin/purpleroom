import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

import { SUBMISSION_STATUSES } from "../lib/constants";
import { formatDate } from "../lib/format";
import { Button, ButtonLink, DistributionChart, SummaryCard } from "../theme";
import type { Paper, SubmissionStatus } from "../types";
import SubmissionEditionLink from "./SubmissionEditionLink";
import SubmissionStatusSelect from "./SubmissionStatusSelect";

const colors: Record<SubmissionStatus, string> = {
  interested: "bg-muted",
  submitted: "bg-info-ink",
  accepted: "bg-avatar-purple",
  rejected: "bg-urgent-ink",
  waitlisted: "bg-soon-ink",
  confirmed: "bg-purple-deep",
  declined: "bg-declined-ink",
  attended: "bg-ink",
};

export default function TalkCard({
  paper,
  onSaved,
}: {
  paper: Paper;
  onSaved: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const items = SUBMISSION_STATUSES.map((status) => ({
    label:
      status === "attended"
        ? "Attended (legacy)"
        : status[0].toUpperCase() + status.slice(1),
    value: paper.submissions.filter(
      (submission) => submission.status === status
    ).length,
    colorClassName: colors[status],
  }));
  const count = paper.submissions.length;
  return (
    <SummaryCard
      title={paper.title}
      to={`/talks/${paper.id}`}
      subtitle={`Updated ${formatDate(paper.updated_at, { day: "numeric", month: "short" })}`}
      footer={
        count ? (
          <Button
            variant="ghost"
            className="w-full justify-between px-0 text-xs"
            aria-label={`${expanded ? "Collapse" : "Expand"} submissions for ${paper.title}`}
            aria-expanded={expanded}
            aria-controls={`talk-submissions-${paper.id}`}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "Hide submissions" : "Manage submissions"}
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </Button>
        ) : (
          <ButtonLink
            to="/"
            variant="ghost"
            className="w-full justify-between px-0 text-xs"
          >
            Find a stage
          </ButtonLink>
        )
      }
    >
      <p className="mb-4 flex items-baseline gap-2">
        <span className="font-mono text-3xl font-medium">{count}</span>
        <span className="text-sm text-muted">
          {count === 1 ? "submission" : "submissions"}
        </span>
      </p>
      {count ? (
        <DistributionChart label="Current submission statuses" items={items} />
      ) : (
        <p className="text-sm leading-relaxed text-muted">
          No submissions yet. Add this talk to an edition to start tracking its
          progress.
        </p>
      )}
      {expanded && (
        <div
          id={`talk-submissions-${paper.id}`}
          className="mt-5 space-y-5 border-t border-divider pt-4"
        >
          {paper.submissions.map((submission) => (
            <div key={submission.id} className="min-w-0 space-y-2">
              <SubmissionEditionLink
                submission={submission}
                className="block break-words text-sm font-semibold hover:text-purple"
              />
              <SubmissionStatusSelect
                submission={submission}
                onSaved={onSaved}
              />
            </div>
          ))}
        </div>
      )}
    </SummaryCard>
  );
}
