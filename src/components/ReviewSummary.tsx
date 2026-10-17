import { ThumbsDown, ThumbsUp } from "lucide-react";

import { REVIEW_TAGS } from "../lib/constants";
import { Tag } from "../theme";
import type { ConferenceSummary, ReviewTag } from "../types";

interface ReviewSummaryProps {
  conference: ConferenceSummary;
  className?: string;
}
export default function ReviewSummary({
  conference,
  className = "",
}: ReviewSummaryProps) {
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {Object.entries(conference.tag_counts)
          .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
          .map(([key, count]) => (
            <Tag key={key} count={count}>
              {REVIEW_TAGS[key as ReviewTag]}
            </Tag>
          ))}
      </div>
      {conference.review_count > 0 ? (
        <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-muted">
          <span>Would submit again</span>
          <span className="flex items-center gap-1.5 text-green">
            <ThumbsUp size={14} />
            <span className="font-mono">
              {conference.would_submit_again.yes}
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <ThumbsDown size={14} />
            <span className="font-mono">
              {conference.would_submit_again.no}
            </span>
          </span>
        </div>
      ) : (
        <p className="text-sm text-muted">
          No speaker takes yet. First-hand experience is welcome here.
        </p>
      )}
    </div>
  );
}
