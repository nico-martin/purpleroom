import { ArrowRight, MessageSquare, Plus, Search } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import useApi from "../hooks/useApi";
import { REVIEW_TAGS } from "../lib/constants";
import { dateRange, location } from "../lib/format";
import {
  ButtonLink,
  Card,
  EmptyState,
  Input,
  LoadingState,
  LogoTile,
  Notice,
  PageHeader,
  Tag,
} from "../theme";
import type { ConferenceSummary, ReviewTag } from "../types";

interface ConferencesPageProps {
  className?: string;
}
export default function ConferencesPage({
  className = "",
}: ConferencesPageProps) {
  const { data, loading, error } = useApi<ConferenceSummary[]>("/conferences");
  const [search, setSearch] = useState("");
  const filtered =
    data?.filter((c) =>
      `${c.name} ${c.description ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    ) ?? [];
  return (
    <div className={className}>
      <PageHeader
        eyebrow="The collective shortlist"
        title="Good stages, worth sharing."
        description="Every conference here has a reason to be here. Someone in the crew put it on the map."
        action={
          <ButtonLink to="/conferences/new" variant="primary">
            <Plus size={16} />
            Add a conference
          </ButtonLink>
        }
      />
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <span className="text-sm text-muted">
          {data?.length ?? 0} conferences in the room
        </span>
        <div className="relative w-full sm:w-72">
          <Search
            size={17}
            className="pointer-events-none absolute left-3 top-3.5 text-muted"
          />
          <Input
            aria-label="Search conferences"
            placeholder="Find a conference…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <Notice tone="error">{error}</Notice>
      ) : filtered.length ? (
        <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
          {filtered.map((conference) => (
            <Card padded key={conference.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-4">
                <LogoTile name={conference.name} src={conference.logo_url} />
                <Link
                  to={`/conferences/${conference.id}`}
                  aria-label={`View ${conference.name}`}
                  className="flex size-11 items-center justify-center rounded-xl text-muted hover:bg-ground hover:text-green"
                >
                  <ArrowRight size={18} />
                </Link>
              </div>
              <Link
                to={`/conferences/${conference.id}`}
                className="mt-4 font-heading text-xl font-semibold hover:text-green"
              >
                {conference.name}
              </Link>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted">
                {conference.description ||
                  "A new addition to the crew's shortlist. Got the inside story? Share a speaker take."}
              </p>
              <div className="my-5 flex flex-wrap gap-2">
                {Object.entries(conference.tag_counts)
                  .slice(0, 3)
                  .map(([tag, count]) => (
                    <Tag key={tag} count={count}>
                      {REVIEW_TAGS[tag as ReviewTag]}
                    </Tag>
                  ))}
              </div>
              <div className="mt-auto border-t border-divider pt-4">
                <p className="flex items-center gap-2 text-xs text-muted">
                  <MessageSquare size={13} />
                  {conference.review_count}{" "}
                  {conference.review_count === 1
                    ? "speaker take"
                    : "speaker takes"}
                </p>
                {conference.next_edition && (
                  <Link
                    to={`/editions/${conference.next_edition.id}`}
                    className="mt-3 block text-xs text-muted"
                  >
                    <span className="font-semibold text-ink">
                      Up next: {conference.next_edition.year}
                    </span>{" "}
                    · {location(conference.next_edition)} ·{" "}
                    {dateRange(conference.next_edition)}
                  </Link>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <EmptyState
            title={search ? "No stages by that name." : "Start the shortlist."}
            description={
              search
                ? "Try another name, or add it to the room."
                : "Know a conference that treats its speakers well? That's a great place to start."
            }
            action={
              <ButtonLink to="/conferences/new" variant="dashed">
                <Plus size={16} />
                Add a conference
              </ButtonLink>
            }
          />
        </Card>
      )}
    </div>
  );
}
