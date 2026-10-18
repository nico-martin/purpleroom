import { Plus, Search } from "lucide-react";
import { useState } from "react";

import ConferenceCard from "../components/ConferenceCard";
import useApi from "../hooks/useApi";
import useSession from "../hooks/useSession";
import {
  ButtonLink,
  Card,
  EmptyState,
  Input,
  LoadingState,
  Notice,
  PageHeader,
} from "../theme";
import type { ConferenceSummary } from "../types";

interface ConferencesPageProps {
  className?: string;
}
export default function ConferencesPage({
  className = "",
}: ConferencesPageProps) {
  const { data, loading, error } = useApi<ConferenceSummary[]>("/conferences");
  const [search, setSearch] = useState("");
  const isAdmin = useSession().user.role === "admin";
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
          isAdmin && (
            <ButtonLink to="/conferences/new" variant="primary">
              <Plus size={16} />
              Add a conference
            </ButtonLink>
          )
        }
      />
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <span className="text-sm text-muted">
          {search
            ? `${filtered.length} ${filtered.length === 1 ? "match" : "matches"}`
            : `${data?.length ?? 0} conferences in the room`}
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
        <ul
          aria-label="Conferences"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4"
        >
          {filtered.map((conference) => (
            <li key={conference.id} className="min-w-0">
              <ConferenceCard conference={conference} />
            </li>
          ))}
        </ul>
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
              isAdmin && (
                <ButtonLink to="/conferences/new" variant="dashed">
                  <Plus size={16} />
                  Add a conference
                </ButtonLink>
              )
            }
          />
        </Card>
      )}
    </div>
  );
}
