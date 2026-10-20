import { PROFILE_LINKS } from "../lib/profile";
import { Card, CopyButton, SectionHeader } from "../theme";
import type { SpeakerProfile } from "../types";
import SpeakerBios from "./SpeakerBios";
import SpeakerPictureCard from "./SpeakerPictureCard";
import SpeakerProfileLink from "./SpeakerProfileLink";
import SpeakerProfileMasthead from "./SpeakerProfileMasthead";

export default function SpeakerProfileView({
  profile,
}: {
  profile: SpeakerProfile;
}) {
  return (
    <article className="space-y-8 break-words">
      <header>
        <SpeakerProfileMasthead
          name={profile.name}
          headerImage={profile.header_image}
          profileImage={profile.profile_image}
        >
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">
            Speaker press kit
          </p>
          <h1 aria-label={profile.name}>
            <CopyButton
              appearance="text"
              className="font-heading text-4xl"
              value={profile.name}
              label="speaker name"
            />
          </h1>
          {(
            [
              ["tagline", "Tagline"],
              ["job_title", "Job title"],
              ["company", "Company"],
              ["contact_email", "Public contact email"],
            ] as const
          ).map(
            ([field, label]) =>
              profile[field] && (
                <div key={field} className="mt-4 space-y-1">
                  <p className="px-3 text-xs text-muted">{label}</p>
                  <CopyButton
                    appearance="text"
                    value={profile[field]}
                    label={label}
                  />
                </div>
              )
          )}
        </SpeakerProfileMasthead>
      </header>
      {profile.bios.length > 0 && (
        <section aria-label="Bios">
          <SectionHeader title="Bios" />
          <SpeakerBios bios={profile.bios} />
        </section>
      )}
      {profile.pictures.length > 0 && (
        <section aria-label="Speaker pictures">
          <SectionHeader title="Speaker pictures" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {profile.pictures.map((picture) => (
              <SpeakerPictureCard key={picture.id} picture={picture} />
            ))}
          </div>
        </section>
      )}
      {profile.links.length > 0 && (
        <section aria-label="Speaker links">
          <SectionHeader title="Links" />
          <ul className="grid gap-3 sm:grid-cols-2">
            {profile.links.map((link) => (
              <li key={link.field} className="min-w-0 space-y-1">
                <p className="px-3 text-xs text-muted">
                  {PROFILE_LINKS.find((p) => p.field === link.field)?.label ??
                    link.field}
                </p>
                <SpeakerProfileLink
                  url={link.url}
                  label={
                    PROFILE_LINKS.find((p) => p.field === link.field)?.label ??
                    link.field
                  }
                  rel="noreferrer me"
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      {profile.appearances.length > 0 && (
        <section aria-label="Selected work">
          <SectionHeader title="Selected talks and appearances" />
          <div className="space-y-4">
            {profile.appearances.map((entry, i) => (
              <Card key={i} padded>
                <p className="text-xs uppercase text-muted">{entry.kind}</p>
                <h3 className="mt-2 text-xl">
                  <CopyButton
                    appearance="text"
                    value={entry.title}
                    label={`work ${i + 1} title`}
                    className="font-heading text-xl"
                  />
                </h3>
                {entry.description && (
                  <CopyButton
                    appearance="text"
                    value={entry.description}
                    label={`work ${i + 1} description`}
                  />
                )}
                <SpeakerProfileLink
                  url={entry.url}
                  label={`${entry.title} link`}
                />
              </Card>
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
