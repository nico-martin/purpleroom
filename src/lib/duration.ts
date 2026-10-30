import type { Paper } from "../types";

/** Accepts "45" or a range such as "20-45" (hyphen or en/em dash). */
export const DURATION_PATTERN = String.raw`\s*\d+\s*([\-–—]\s*\d+\s*)?`;

export function formatDuration(
  paper: Pick<Paper, "duration_minutes" | "duration_max_minutes">
): string {
  if (paper.duration_minutes === null) return "";
  return paper.duration_max_minutes === null
    ? String(paper.duration_minutes)
    : `${paper.duration_minutes}–${paper.duration_max_minutes}`;
}

/** Parses the form value; an equal range collapses to one duration. */
export function parseDuration(
  value: string
): Pick<Paper, "duration_minutes" | "duration_max_minutes"> {
  const [min, max] = value
    .split(/[-–—]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map(Number);
  if (min === undefined)
    return { duration_minutes: null, duration_max_minutes: null };
  return {
    duration_minutes: min,
    duration_max_minutes: max === undefined || max === min ? null : max,
  };
}
