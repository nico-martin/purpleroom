import type { ConferenceSummary } from "../types";

export const CONFERENCE_SORTS = [
  { value: "name_asc", label: "Name: A–Z" },
  { value: "name_desc", label: "Name: Z–A" },
  { value: "next_asc", label: "Next edition: soonest first" },
  { value: "next_desc", label: "Next edition: latest first" },
] as const;
export type ConferenceSort = (typeof CONFERENCE_SORTS)[number]["value"];

const names = new Intl.Collator("en", { sensitivity: "base", numeric: true });

export function sortConferences(
  conferences: ConferenceSummary[],
  sort: ConferenceSort
): ConferenceSummary[] {
  return [...conferences].sort((a, b) => {
    const byName = names.compare(a.name, b.name);
    if (sort === "name_asc" || sort === "name_desc")
      return (sort === "name_desc" ? -byName : byName) || a.id - b.id;
    const first = a.next_edition?.starts_on;
    const second = b.next_edition?.starts_on;
    // Missing dates always stay last, irrespective of the requested date direction.
    if (!first || !second)
      return first ? -1 : second ? 1 : byName || a.id - b.id;
    const byDate = first.localeCompare(second);
    return (sort === "next_desc" ? -byDate : byDate) || byName || a.id - b.id;
  });
}
