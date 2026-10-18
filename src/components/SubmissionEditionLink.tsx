import { Link } from "react-router-dom";

import { editionLabel } from "../lib/format";
import type { Submission } from "../types";

export default function SubmissionEditionLink({
  submission,
  className = "",
}: {
  submission: Submission;
  className?: string;
}) {
  const label = editionLabel(submission.edition, submission.conference?.name);
  if (submission.edition?.deleted_at || submission.conference?.deleted_at)
    return (
      <p className={className}>
        {label}
        <span className="ml-2 text-xs font-normal text-muted">Archived</span>
      </p>
    );
  return (
    <Link to={`/editions/${submission.edition_id}`} className={className}>
      {label}
    </Link>
  );
}
