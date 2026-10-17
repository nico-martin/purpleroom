import type { Edition } from "../types";

export function formatDate(
  value: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  if (!value) return "Dates to come";
  return new Intl.DateTimeFormat(
    "en-GB",
    options ?? { day: "numeric", month: "short", year: "numeric" }
  ).format(new Date(value.length === 10 ? `${value}T12:00:00` : value));
}
export function dateRange(edition: Edition): string {
  if (!edition.starts_on)
    return edition.ends_on
      ? `Ends ${formatDate(edition.ends_on)}`
      : "Dates to come";
  const start = formatDate(edition.starts_on);
  if (!edition.ends_on || edition.ends_on === edition.starts_on) return start;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).formatRange(
    new Date(`${edition.starts_on}T12:00:00`),
    new Date(`${edition.ends_on}T12:00:00`)
  );
}
export function editionLabel(
  edition: Pick<Edition, "title"> | undefined,
  conferenceName = "Conference"
): string {
  return edition?.title?.trim() || conferenceName;
}
export function location(edition: Edition): string {
  return edition.online
    ? "Online"
    : [edition.city, edition.country].filter(Boolean).join(", ") ||
        "Location to come";
}
export function daysUntil(date: string): number {
  return Math.ceil(
    (Date.parse(date + "T00:00:00Z") -
      Date.parse(new Date().toISOString().slice(0, 10) + "T00:00:00Z")) /
      86400000
  );
}
export function relativeTime(date: string): string {
  const days = Math.floor((Date.now() - Date.parse(date)) / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  return days < 7
    ? `${days} days ago`
    : formatDate(date, { day: "numeric", month: "short" });
}
export function initials(name: string): string {
  return name
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
export function nameColor(name: string): number {
  return (
    Array.from(name).reduce((value, char) => value + char.charCodeAt(0), 0) % 4
  );
}

export function websiteHost(website: string | null): string {
  if (!website) return "";
  try {
    return new URL(website).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
