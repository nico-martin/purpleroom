export const PROFILE_LINKS = [
  {
    field: "homepage_url",
    label: "Homepage",
    placeholder: "https://your-site.example",
  },
  {
    field: "github_url",
    label: "GitHub",
    placeholder: "https://github.com/username",
  },
  {
    field: "linkedin_url",
    label: "LinkedIn",
    placeholder: "https://www.linkedin.com/in/username",
  },
  { field: "x_url", label: "X", placeholder: "https://x.com/username" },
  {
    field: "bluesky_url",
    label: "Bluesky",
    placeholder: "https://bsky.app/profile/username.bsky.social",
  },
  {
    field: "instagram_url",
    label: "Instagram",
    placeholder: "https://www.instagram.com/username",
  },
  {
    field: "youtube_url",
    label: "YouTube",
    placeholder: "https://www.youtube.com/@username",
  },
  {
    field: "mastodon_url",
    label: "Mastodon",
    placeholder: "https://your-instance.social/@username",
  },
] as const;

export type ProfileLinkField = (typeof PROFILE_LINKS)[number]["field"];
export type ProfileLinks = Partial<Record<ProfileLinkField, string | null>>;

export function profileLinkValues(
  profile: ProfileLinks
): Record<ProfileLinkField, string> {
  return Object.fromEntries(
    PROFILE_LINKS.map(({ field }) => [field, profile[field] ?? ""])
  ) as Record<ProfileLinkField, string>;
}
