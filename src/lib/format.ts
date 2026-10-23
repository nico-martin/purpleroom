import type { Edition } from "../types";
import { isViewerTimezone, timezoneLabel } from "./timezones";

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
export function dateWithTimezone(
  value: string | null | undefined,
  zone: string | null | undefined,
  options?: Intl.DateTimeFormatOptions
): string {
  return `${formatDate(value, options)}${value && zone && !isViewerTimezone(zone) ? ` (${timezoneLabel(zone)})` : ""}`;
}
export function cfpClosingTime(edition: Edition): string {
  if (!edition.cfp_closes_timezone) return "Timezone not set";
  if (isViewerTimezone(edition.cfp_closes_timezone))
    return edition.cfp_closes_time ?? "23:59";
  let offset = "";
  if (edition.cfp_closes_at) {
    try {
      offset =
        new Intl.DateTimeFormat("en-GB", {
          timeZone: edition.cfp_closes_timezone,
          timeZoneName: "shortOffset",
        })
          .formatToParts(new Date(edition.cfp_closes_at))
          .find((part) => part.type === "timeZoneName")?.value ?? "";
    } catch {
      /* Older browsers may not know a newly introduced IANA zone; keep the saved local time and zone visible. */
    }
  }
  return `${edition.cfp_closes_time ?? "23:59"} (${timezoneLabel(edition.cfp_closes_timezone)}${offset ? `, ${offset.replace(/^GMT/, "UTC")}` : ""})`;
}
export function cfpDaysUntil(edition: Edition): number {
  if (edition.cfp_closes_at && Date.parse(edition.cfp_closes_at) < Date.now())
    return -1;
  if (!edition.cfp_closes_on) return 0;
  if (!edition.cfp_closes_timezone) return daysUntil(edition.cfp_closes_on);
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: edition.cfp_closes_timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
  } catch {
    return edition.cfp_closes_at
      ? Math.ceil((Date.parse(edition.cfp_closes_at) - Date.now()) / 86400000)
      : daysUntil(edition.cfp_closes_on);
  }
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value;
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  return Math.round(
    (Date.parse(edition.cfp_closes_on + "T00:00:00Z") -
      Date.parse(today + "T00:00:00Z")) /
      86400000
  );
}
export function dateRange(
  edition: Pick<
    Edition,
    "starts_on" | "ends_on" | "starts_timezone" | "ends_timezone"
  >
): string {
  if (edition.starts_timezone || edition.ends_timezone) {
    if (!edition.starts_on)
      return edition.ends_on
        ? `Ends ${dateWithTimezone(edition.ends_on, edition.ends_timezone)}`
        : "Dates to come";
    const start = dateWithTimezone(edition.starts_on, edition.starts_timezone);
    if (
      !edition.ends_on ||
      (edition.ends_on === edition.starts_on &&
        edition.ends_timezone === edition.starts_timezone)
    )
      return start;
    return `${start} – ${dateWithTimezone(edition.ends_on, edition.ends_timezone)}`;
  }
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
