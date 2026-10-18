import { Check, Plus } from "lucide-react";
import { Link } from "react-router-dom";

import { dateRange, editionLabel, formatDate, location } from "../lib/format";
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
    <ListRow className={className}>
      <Link
        to={`/editions/${edition.id}`}
        className="flex w-full min-w-0 items-center gap-3 sm:w-auto sm:flex-1"
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
      <div className="flex min-w-24 flex-col items-start gap-1">
        <DeadlineBadge days={days_left} />
        <span className="font-mono text-xs text-muted">
          closes{" "}
          {formatDate(edition.cfp_closes_on, {
            day: "numeric",
            month: "short",
          })}
        </span>
      </div>
      <div className="flex flex-col items-center gap-1">
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
      <Button onClick={onSubmit} className="ml-auto text-xs">
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
