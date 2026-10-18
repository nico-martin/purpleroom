import { Plus, Search, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";

import ConferenceCard from "../components/ConferenceCard";
import useApi from "../hooks/useApi";
import useSession from "../hooks/useSession";
import { CONFERENCE_SORTS, sortConferences } from "../lib/conferences";
import {
  ButtonLink,
  Button,
  Card,
  Checkbox,
  EmptyState,
  Input,
  Field,
  LoadingState,
  Notice,
  PageHeader,
  Select,
  Tag,
} from "../theme";
import type { ConferenceSummary } from "../types";

interface ConferencesPageProps {
  className?: string;
}
export default function ConferencesPage({
  className = "",
}: ConferencesPageProps) {
  const { data, loading, error } = useApi<ConferenceSummary[]>("/conferences");
  const [params, setParams] = useSearchParams();
  const search = params.get("q") ?? "";
  const selectedTags = params.getAll("tag");
  const openOnly = params.get("cfp_open") === "1";
  const sort =
    CONFERENCE_SORTS.find((option) => option.value === params.get("sort"))
      ?.value ?? "name_asc";
  function setValue(key: string, value: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );
  }
  function toggleTag(tag: string) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        const tags = next.getAll("tag");
        next.delete("tag");
        for (const value of tags.includes(tag)
          ? tags.filter((value) => value !== tag)
          : [...tags, tag])
          next.append("tag", value);
        return next;
      },
      { replace: true }
    );
  }
  function clearFilters() {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        for (const key of ["q", "tag", "cfp_open"]) next.delete(key);
        return next;
      },
      { replace: true }
    );
  }
  const availableTags = [
    ...new Set([
      ...(data ?? []).flatMap((conference) => conference.tags ?? []),
      ...selectedTags,
    ]),
  ].sort((a, b) => a.localeCompare(b));
  const hasFilters = !!search || selectedTags.length > 0 || openOnly;
  const isAdmin = useSession().user.role === "admin";
  const filtered = sortConferences(
    (data ?? []).filter(
      (conference) =>
        `${conference.name} ${conference.description ?? ""} ${(conference.tags ?? []).join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase()) &&
        (!selectedTags.length ||
          selectedTags.some((tag) => (conference.tags ?? []).includes(tag))) &&
        (!openOnly || conference.has_open_cfp)
    ),
    sort
  );
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
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="relative w-full sm:w-72">
          <Search
            size={17}
            className="pointer-events-none absolute left-3 top-3.5 text-muted"
          />
          <Input
            aria-label="Search conferences"
            placeholder="Find a conference…"
            value={search}
            onChange={(e) => setValue("q", e.target.value)}
            className="pl-10"
          />
        </div>
        <Field label="Sort conferences" className="w-full sm:w-72">
          <Select
            value={sort}
            onChange={(event) => setValue("sort", event.target.value)}
          >
            {CONFERENCE_SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {availableTags.length > 0 && (
        <fieldset className="mb-4">
          <legend className="mb-2 text-sm font-semibold">Filter by tags</legend>
          <div className="flex flex-wrap gap-2">
            {availableTags.map((tag) => (
              <Tag
                key={tag}
                selected={selectedTags.includes(tag)}
                onClick={() => toggleTag(tag)}
                className="max-w-full"
              >
                <span className="min-w-0 break-all">{tag}</span>
              </Tag>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">Matches any selected tag.</p>
        </fieldset>
      )}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Checkbox
          label="Have editions with open CFPs"
          checked={openOnly}
          onChange={(event) =>
            setValue("cfp_open", event.target.checked ? "1" : "")
          }
        />
        <div className="flex items-center gap-3">
          <span aria-live="polite" className="text-sm text-muted">
            {hasFilters
              ? `${filtered.length} ${filtered.length === 1 ? "match" : "matches"}`
              : `${filtered.length} conferences in the room`}
          </span>
          {hasFilters && (
            <Button variant="ghost" onClick={clearFilters} className="text-xs">
              <X size={14} />
              Clear filters
            </Button>
          )}
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
            title={
              hasFilters ? "No conferences match." : "Start the shortlist."
            }
            description={
              hasFilters
                ? "Try a different search or clear the filters."
                : "Know a conference that treats its speakers well? That's a great place to start."
            }
            action={
              !hasFilters &&
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
