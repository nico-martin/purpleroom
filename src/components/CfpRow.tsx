import { Check, Plus } from "lucide-react";
import { Link } from "react-router-dom";

import {
  cfpClosingTime,
  dateRange,
  editionLabel,
  formatDate,
  location,
} from "../lib/format";
import {
  AvatarStack,
  Button,
  DeadlineBadge,
  ListRow,
  LogoTile,
} from "../theme";
import type { Cfp } from "../types";

interface CfpRowProps {
  cfp: Cfp;
  onSubmit: () => void;
  className?: string;
}
export default function CfpRow({ cfp, onSubmit, className = "" }: CfpRowProps) {
  const { edition, conference, days_left, submitters, my_submissions } = cfp;
  return (
    <ListRow className={`@3xl:flex-nowrap ${className}`}>
      <Link
        to={`/editions/${edition.id}`}
        className="flex w-full min-w-0 items-center gap-3 @3xl:w-auto @3xl:flex-1"
      >
        <LogoTile name={conference.name} src={conference.logo_url} />
        <div className="min-w-0">
          <h3 className="break-words text-base hover:text-green">
            {editionLabel(edition, conference.name)}
          </h3>
          <p className="mt-1 text-xs text-muted">
            {location(edition)}
            <span className="px-1.5">·</span>
            {dateRange(edition)}
          </p>
        </div>
      </Link>
      <div className="flex w-32 shrink-0 flex-col items-start gap-1 @3xl:w-40">
        <DeadlineBadge days={days_left} />
        <span className="font-mono text-xs text-muted">
          closes{" "}
          {formatDate(edition.cfp_closes_on, {
            day: "numeric",
            month: "short",
          })}
        </span>
        <span className="max-w-full break-words text-xs text-muted">
          {cfpClosingTime(edition)}
        </span>
      </div>
      <div className="flex w-36 max-w-full shrink-0 flex-col items-center gap-1">
        {submitters.length ? (
          <AvatarStack users={submitters} max={3} />
        ) : (
          <span className="text-xs text-muted">No friends submitted yet</span>
        )}
        {submitters.length > 0 && (
          <span className="text-xs text-muted">
            {submitters.length} {submitters.length === 1 ? "friend" : "friends"}{" "}
            submitted
          </span>
        )}
      </div>
      <Button
        onClick={onSubmit}
        className="ml-auto w-40 shrink-0 text-xs @3xl:ml-0"
      >
        {my_submissions.length ? (
          <>
            <Check size={14} className="text-green" />
            Submission added
          </>
        ) : (
          <>
            <Plus size={14} />
            Add my talk
          </>
        )}
      </Button>
    </ListRow>
  );
}
