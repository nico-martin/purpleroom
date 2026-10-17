export default function cn(
  ...classes: Array<string | undefined | false | Record<string, boolean>>
): string {
  return classes
    .map((entry) =>
      typeof entry === "object"
        ? Object.entries(entry)
            .filter(([, value]) => value)
            .map(([key]) => key)
            .join(" ")
        : entry
    )
    .filter(Boolean)
    .join(" ");
}
