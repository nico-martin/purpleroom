export function browserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

// These are shortcuts to location-based rules, never fixed offsets. Keep the
// selected city when it belongs to a group: a friendly label must not rewrite it.
const commonTimezones = [
  {
    label: "Central European Time",
    zone: "Europe/Zurich",
    cities: [
      "Europe/Zurich",
      "Europe/Amsterdam",
      "Europe/Berlin",
      "Europe/Paris",
      "Europe/Rome",
      "Europe/Vienna",
      "Europe/Brussels",
      "Europe/Madrid",
      "Europe/Prague",
      "Europe/Warsaw",
      "Europe/Stockholm",
      "Europe/Oslo",
      "Europe/Copenhagen",
      "Europe/Luxembourg",
    ],
  },
  {
    label: "UK & Ireland Time",
    zone: "Europe/London",
    cities: ["Europe/London", "Europe/Dublin"],
  },
  { label: "Eastern European Time — Athens", zone: "Europe/Athens" },
  { label: "Eastern Time — New York", zone: "America/New_York" },
  { label: "Central Time — Chicago", zone: "America/Chicago" },
  { label: "Mountain Time — Denver", zone: "America/Denver" },
  { label: "Pacific Time — Los Angeles", zone: "America/Los_Angeles" },
  {
    label: "India Time",
    zone: "Asia/Kolkata",
    cities: ["Asia/Kolkata", "Asia/Calcutta"],
  },
  { label: "China Time — Shanghai", zone: "Asia/Shanghai" },
  { label: "Japan Time", zone: "Asia/Tokyo" },
  { label: "Eastern Australia Time — Sydney", zone: "Australia/Sydney" },
  { label: "New Zealand Time — Auckland", zone: "Pacific/Auckland" },
  { label: "UTC", zone: "UTC" },
];

export function commonTimezoneOptions(
  value: string
): { label: string; value: string }[] {
  const options = commonTimezones.map((item) => ({
    label: item.label,
    value: (item.cities ?? [item.zone]).includes(value) ? value : item.zone,
  }));
  if (value && !options.some((option) => option.value === value)) {
    options.unshift({ label: value.replaceAll("_", " "), value });
  }
  return options;
}

export function timezoneLabel(zone: string): string {
  return (
    commonTimezones.find((item) => (item.cities ?? [item.zone]).includes(zone))
      ?.label ?? zone.replaceAll("_", " ")
  );
}

export function isViewerTimezone(zone: string): boolean {
  function timezoneKey(value: string): string {
    try {
      value = new Intl.DateTimeFormat("en", {
        timeZone: value,
      }).resolvedOptions().timeZone;
    } catch {
      // Unknown zones must not be mistaken for the viewer's zone.
    }
    return (
      commonTimezones.find((item) =>
        (item.cities ?? [item.zone]).includes(value)
      )?.zone ?? value
    );
  }
  // Use IANA identities/curated rule groups, not an offset that may only match
  // today (for example, Phoenix and Denver diverge during daylight saving).
  return timezoneKey(zone) === timezoneKey(browserTimezone());
}

export function timezoneOptions(value: string): string[] {
  const intl = Intl as typeof Intl & {
    supportedValuesOf?: (key: "timeZone") => string[];
  };
  return [
    ...new Set([
      "UTC",
      browserTimezone(),
      ...(value ? [value] : []),
      ...commonTimezones.flatMap((item) => item.cities ?? [item.zone]),
      ...(intl.supportedValuesOf?.("timeZone") ?? []),
    ]),
  ].sort();
}
