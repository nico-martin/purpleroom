# Public speaker API

Only explicitly published speaker press-kit JSON is accessible. Speaker images have separate public capability URLs that work without login even when the profile is private. No API key, cookies or public write API is needed. Discover a speaker's username from their shared `/u/{username}` link; there is no public directory or image enumeration endpoint.

The deployed machine-readable contract is [`/speaker-openapi.json`](../public/speaker-openapi.json) (OpenAPI 3.1). Paths are relative to the installation's configured base URL, not a hardcoded hostname. Use returned `profile_url`, `api_url` and picture URLs; `speaker_id` remains stable across username changes. Username changes retire the old URL and unpublish until the owner explicitly turns public sharing on again.

The optional `sharing` object contains `profile_url`, `image_url` and `twitter_image_url` for the published profile's Shareable preview. Image URLs use `https://shareable.nico.dev/render` and a cache version derived from the publication revision. These are externally generated/cached social images, not the protected source-branding routes; third-party caches can outlive unpublishing. Private edits do not change them until explicit publication/update. No private toolkit information is sent to Shareable.

```http
GET /api/public/speakers/alex-speaker
Accept: application/json
```

```json
{
  "schema_version": 1,
  "speaker_id": "spk_aabbccddeeff00112233445566778899",
  "username": "alex-speaker",
  "name": "Alex Speaker",
  "profile_url": "https://conference-tools.example/u/alex-speaker",
  "api_url": "https://conference-tools.example/api/public/speakers/alex-speaker",
  "tagline": "Building accessible software",
  "bios": [{"label": "Short / English", "text": "Alex builds accessible software."}],
  "pictures": [],
  "links": [{"field": "homepage_url", "url": "https://alex.example"}],
  "appearances": []
}
```

Publishing includes all saved speaker-profile information. `tagline`, `company`, `job_title` and `contact_email` appear when nonempty; older snapshots may also omit optional fields. `contact_email` is separately supplied by the owner, never inferred from their login email. All saved bios, links, pictures and manually entered work are included when publishing/updating; lists always exist but may be empty. All text is plain text, not HTML or Markdown. Labels may identify bio length or language. Work entries have `kind` (`talk`, `recording`, `slides`, `appearance`), `title`, `url` and `description`; they do not reference private proposals or submissions. The eight link field keys match existing profile-link conventions.

`header_image` and `profile_image` are nullable picture objects for a separately uploaded custom cover and a snapshot of the owner's saved Purple Room profile picture. They share the gallery picture shape but may have an empty variants map; they need not appear in `pictures`. Their `/api/speaker-branding/{token}` image URLs require current publication and snapshot membership, unlike gallery capability URLs. The authenticated account-avatar URL is never exposed. The cover is centre-cropped to 4:1; the portrait is displayed as an overlapping circle. Saving edits never updates these published snapshots automatically. Older snapshots retain their previous fields/images. New username claims require 4–40 characters; existing URLs remain usable until the owner changes the username.

Pictures expose `id`, `label`, `credit`, `url`, `download_url` and, for current snapshots, a `variants` map. The top-level URLs retain their original Full behaviour. Each available `s`, `m`, `l`, `xl`, `full` variant has `width`, `height`, exact `file_size` in bytes, `mime_type`, `url` and `download_url`. S/M/L/XL widths are 400/720/1080/1900px, with proportional height; Full keeps the original bytes and display dimensions (including JPEG orientation). New pictures require at least 2000px display width. Older pictures may offer only Full; older published snapshots may omit variants entirely. Do not invent missing size URLs.

Fetch a variant's `url` for preview/clipboard conversion and `download_url` for an attachment. Current URLs use `/api/speaker-pictures/{token}` with an opaque random 48-hex-character token shared by all sizes; append `/sizes/{size}` only as returned by the API, and `/download` for an attachment. These stable URLs are public before profile publication and remain available after unpublishing or username changes. Removing the picture, owner suspension/incompletion or account deletion revokes access. Older revision-scoped URLs remain publication-gated for compatibility. Every image response is no-store; no anonymous session is created.

Variants are pre-generated on save, never resized during public reads. Generated JPEG derivatives stay JPEG; other new raster formats use WebP (PNG fallback). Full retains original metadata; generated variants strip it. Respect credit/usage instructions; a public URL does not grant unspecified reuse rights. Anyone holding a token URL can access its image; do not assume a private profile makes an already-shared picture URL private.

## Availability, privacy and errors

- Profile JSON and media share **120 requests per direct peer IP per fixed 60-second window**, beginning with the first request. No forwarded-IP headers are trusted. Reverse proxies may cause multiple clients to share a budget. All successes and errors use `Cache-Control: no-store`; media additionally has restrictive CSP and `nosniff` headers. Static OpenAPI and app-shell assets are not part of this budget.
- For profile JSON, 404 covers unknown, private, unpublished, deleted, incomplete and suspended speakers. For token image URLs, 404 covers invalid/unknown tokens or sizes, removed pictures and deleted/incomplete/suspended owners, not private/unpublished profiles. Publication replacement invalidates only legacy media revisions. Suspension hides profiles/images until restoration. Clients must not interpret a 404 as evidence that an account does not exist.
- 429 includes `Retry-After: 60`. A transient backend failure can return 500 or 503; retry with backoff, never enumerate usernames or circumvent limits.
- Error bodies use the existing consistent shape:

```json
{"error":{"code":"not_found","message":"Speaker profile not found.","fields":{}}}
```

- Reads create no session. No CORS/cross-origin API permission is added; server-side agents may consume the same-origin public JSON using ordinary HTTP.
- Owners publish an explicit complete speaker-profile snapshot using a default-off switch, not a live private-account view. No per-field selection or preview is required. Saved edits do not update it until the owner chooses Update public profile; previously published snapshots are never automatically expanded. Private proposals, submissions, crew information and login email never enter the snapshot. Unpublishing revokes profile JSON but not stable public image URLs. Downloaded or third-party cached copies cannot be recalled.
