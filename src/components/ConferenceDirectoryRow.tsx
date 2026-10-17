import { CalendarDays, MapPin, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

import { REVIEW_TAGS } from "../lib/constants";
import { editionLabel, formatDate, location, websiteHost } from "../lib/format";
import { DirectoryRow, Tag } from "../theme";
import type { ConferenceSummary, ReviewTag } from "../types";

interface ConferenceDirectoryRowProps {
  conference: ConferenceSummary;
  className?: string;
}

export default function ConferenceDirectoryRow({
  conference,
  className = "",
}: ConferenceDirectoryRowProps) {
  const edition = conference.next_edition;
  const tags = Object.entries(conference.tag_counts)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .slice(0, 2);
  return (
    <DirectoryRow
      className={className}
      title={conference.name}
      to={`/conferences/${conference.id}`}
      subtitle={websiteHost(conference.website)}
      secondary={
        edition ? (
          <Link
            to={`/editions/${edition.id}`}
            aria-label={`${editionLabel(edition, conference.name)} edition`}
            className="inline-flex min-h-11 max-w-full flex-col justify-center gap-2 rounded-sm text-sm hover:text-green"
          >
            {edition.title && edition.title !== conference.name && (
              <span className="text-xs font-semibold">{edition.title}</span>
            )}
            <span className="flex items-center gap-2">
              <CalendarDays
                aria-hidden="true"
                size={14}
                className="shrink-0 text-muted"
              />
              <span className="font-mono text-xs">
                {formatDate(edition.starts_on)}
              </span>
            </span>
            <span className="flex items-start gap-2 text-xs text-muted">
              <MapPin aria-hidden="true" size={14} className="shrink-0" />
              <span className="break-words">{location(edition)}</span>
            </span>
          </Link>
        ) : (
          <p className="flex min-h-6 items-center text-xs text-muted">
            No upcoming edition
          </p>
        )
      }
      detail={
        <div className="space-y-2.5">
          <p className="flex min-h-6 items-center gap-2 text-xs text-muted">
            <MessageSquare aria-hidden="true" size={14} className="shrink-0" />
            {conference.review_count > 0
              ? `${conference.review_count} ${conference.review_count === 1 ? "speaker take" : "speaker takes"}`
              : "No speaker takes yet"}
          </p>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map(([tag, count]) => (
                <Tag key={tag} count={count}>
                  {REVIEW_TAGS[tag as ReviewTag]}
                </Tag>
              ))}
            </div>
          )}
        </div>
      }
    />
  );
}
