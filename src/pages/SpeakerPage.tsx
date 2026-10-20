import SpeakerBios from "../components/SpeakerBios";
import SpeakerPictureCard from "../components/SpeakerPictureCard";
import SpeakerSharingPreview from "../components/SpeakerSharingPreview";
import useApi from "../hooks/useApi";
import useSession from "../hooks/useSession";
import { PROFILE_LINKS } from "../lib/profile";
import {
  ButtonLink,
  Card,
  CopyButton,
  EmptyState,
  LoadingState,
  Notice,
  PageHeader,
  SectionHeader,
} from "../theme";
import type { SpeakerInformation } from "../types";

export default function SpeakerPage() {
  const { user } = useSession();
  const { data, error, loading, refresh } =
    useApi<SpeakerInformation>("/speaker");
  if (loading) return <LoadingState />;
  if (error || !data)
    return (
      <Notice tone="error">
        {error ?? "Could not load your speaker toolkit."}
        <button type="button" className="ml-3 underline" onClick={refresh}>
          Try again
        </button>
      </Notice>
    );
  const { draft, pictures } = data;
  const links = PROFILE_LINKS.filter((link) => user[link.field]);
  return (
    <div className="max-w-4xl space-y-9">
      <PageHeader
        title="Speaker toolkit"
        description="Your private copy-and-go space. Click any text or its copy icon to copy it for your next CFP."
        action={
          <ButtonLink to="/settings/speaker">Open speaker settings</ButtonLink>
        }
      />
      <Notice>
        This toolkit is private and read-only, even when you have a public press
        kit. Edit your information and control publication in Speaker settings.
      </Notice>
      <section aria-label="Speaker details">
        <SectionHeader title="Speaker details" />
        <Card padded className="space-y-3">
          <div className="space-y-1">
            <p className="px-3 text-xs text-muted">Name</p>
            <CopyButton
              appearance="text"
              value={user.name}
              label="speaker name"
            />
          </div>
          {(
            [
              ["tagline", "Tagline"],
              ["company", "Company"],
              ["job_title", "Job title"],
              ["contact_email", "Public contact email"],
            ] as const
          ).map(
            ([field, label]) =>
              draft[field] && (
                <div key={field} className="space-y-1">
                  <p className="px-3 text-xs text-muted">{label}</p>
                  <CopyButton
                    appearance="text"
                    value={draft[field]}
                    label={label}
                  />
                </div>
              )
          )}
          {!draft.tagline &&
            !draft.company &&
            !draft.job_title &&
            !draft.contact_email && (
              <p className="text-sm text-muted">
                Add a tagline, company, job title or contact address in Speaker
                settings to reuse it here.
              </p>
            )}
        </Card>
      </section>
      <section aria-label="Bio variants">
        <SectionHeader title="Bio variants" />
        {draft.bios.length ? (
          <SpeakerBios bios={draft.bios} />
        ) : (
          <EmptyState
            title="Your bios, ready to go."
            description="Save named bio variants in Speaker settings, then click to copy them here."
          />
        )}
      </section>
      <section aria-label="Reusable links">
        <SectionHeader title="Homepage and socials" />
        {links.length ? (
          <Card padded className="grid gap-3 sm:grid-cols-2">
            {links.map((link) => (
              <div key={link.field} className="min-w-0 space-y-1">
                <p className="px-3 text-xs text-muted">{link.label}</p>
                <CopyButton
                  appearance="text"
                  value={user[link.field] ?? ""}
                  label={link.label}
                  tone="accent"
                />
              </div>
            ))}
          </Card>
        ) : (
          <p className="text-sm text-muted">
            No links saved yet. Add your homepage and socials in Speaker
            settings.
          </p>
        )}
      </section>
      <section aria-label="Speaker pictures">
        <SectionHeader title="Speaker pictures" />
        {pictures.length ? (
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {pictures.map((picture) => (
              <SpeakerPictureCard key={picture.id} picture={picture} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">
            No speaker pictures saved yet. Add them in Speaker settings to
            preview and download them here.
          </p>
        )}
      </section>
      <SpeakerSharingPreview sharing={data.sharing} />
      <section aria-label="Papers">
        <SectionHeader title="Papers" />
        <Card padded>
          <p className="text-sm text-muted">Coming soon.</p>
          <a
            href="https://github.com/nico-martin/purpleroom/issues/2"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-flex min-h-11 items-center text-sm text-green underline underline-offset-4"
          >
            Follow this feature on GitHub
          </a>
        </Card>
      </section>
      {draft.appearances.length > 0 && (
        <section aria-label="Saved work">
          <SectionHeader title="Talks and appearances" />
          <div className="space-y-4">
            {draft.appearances.map((entry, i) => (
              <Card key={i} padded>
                <p className="mb-2 text-xs uppercase text-muted">
                  {entry.kind}
                </p>
                <h3>
                  <CopyButton
                    appearance="text"
                    value={entry.title}
                    label={`work ${i + 1} title`}
                    className="font-heading text-xl"
                  />
                </h3>
                <div>
                  <CopyButton
                    appearance="text"
                    value={entry.url}
                    label={`work ${i + 1} URL`}
                    tone="accent"
                  />
                </div>
                {entry.description && (
                  <CopyButton
                    appearance="text"
                    value={entry.description}
                    label={`work ${i + 1} description`}
                  />
                )}
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
