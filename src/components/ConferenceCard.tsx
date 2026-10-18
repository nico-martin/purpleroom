import { CalendarDays, MapPin, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

import { editionLabel, formatDate, location, websiteHost } from "../lib/format";
import { Badge, SummaryCard, Tag } from "../theme";
import type { ConferenceSummary } from "../types";

interface ConferenceCardProps {
  conference: ConferenceSummary;
  className?: string;
}

export default function ConferenceCard({
  conference,
  className = "",
}: ConferenceCardProps) {
  const edition = conference.next_edition;
  return (
    <SummaryCard
      className={className}
      title={conference.name}
      to={`/conferences/${conference.id}`}
      subtitle={websiteHost(conference.website)}
      footer={
        <p className="flex items-center gap-2 text-xs text-muted">
          <MessageSquare aria-hidden="true" size={14} className="shrink-0" />
          {conference.review_count > 0
            ? `${conference.review_count} ${conference.review_count === 1 ? "speaker take" : "speaker takes"}`
            : "No speaker takes yet"}
        </p>
      }
    >
      {!!conference.tags?.length && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {conference.tags.slice(0, 3).map((tag) => (
            <Tag key={tag} className="max-w-full px-2 py-1">
              <span className="min-w-0 break-all">{tag}</span>
            </Tag>
          ))}
          {conference.tags.length > 3 && (
            <span
              className="self-center text-xs text-muted"
              title={conference.tags.slice(3).join(", ")}
            >
              +{conference.tags.length - 3}
            </span>
          )}
        </div>
      )}
      {conference.has_open_cfp && (
        <div className="mb-2">
          <Badge tone="positive">Open CFP</Badge>
        </div>
      )}
      {edition ? (
        <Link
          to={`/editions/${edition.id}`}
          aria-label={`${editionLabel(edition, conference.name)} edition`}
          className="inline-flex min-h-11 max-w-full flex-col justify-center gap-2 rounded-sm text-sm hover:text-green"
        >
          {edition.title && edition.title !== conference.name && (
            <span
              className="line-clamp-1 text-xs font-semibold"
              title={edition.title}
            >
              {edition.title}
            </span>
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
        <p className="flex min-h-11 items-center text-xs text-muted">
          No upcoming edition
        </p>
      )}
    </SummaryCard>
  );
}
