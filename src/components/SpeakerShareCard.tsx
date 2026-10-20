import { initials } from "../lib/format";
import type { SpeakerProfile } from "../types";

/** Only receives the public, published snapshot. Never private account/draft data. */
export default function SpeakerShareCard({
  profile,
}: {
  profile: SpeakerProfile;
}) {
  return (
    <div
      data-testid="speaker-share-card"
      className="relative flex h-screen w-full flex-col justify-end overflow-hidden bg-avatar-brand p-12 text-white"
    >
      {profile.header_image && (
        <img
          src={
            profile.header_image.variants?.xl?.url ?? profile.header_image.url
          }
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-linear-to-t from-avatar-brand via-avatar-brand/90 to-avatar-brand/20" />
      <div className="relative flex items-center gap-8">
        <div className="flex size-40 shrink-0 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-avatar-brand text-6xl">
          {profile.profile_image ? (
            <img
              src={
                profile.profile_image.variants?.s?.url ??
                profile.profile_image.url
              }
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            initials(profile.name)
          )}
        </div>
        <div className="min-w-0">
          <p className="mb-3 font-mono text-lg uppercase tracking-widest">
            Speaker press kit
          </p>
          <h1 className="line-clamp-2 break-words text-6xl">{profile.name}</h1>
          {profile.tagline && (
            <p className="mt-4 line-clamp-2 break-words text-3xl">
              {profile.tagline}
            </p>
          )}
        </div>
      </div>
      <div className="relative mt-10 flex items-end justify-between gap-6 border-t border-white/30 pt-5 text-xl">
        <p className="min-w-0 truncate">
          {profile.profile_url.replace(/^https?:\/\//, "")}
        </p>
        <p className="shrink-0 font-heading">purpleroom</p>
      </div>
    </div>
  );
}
