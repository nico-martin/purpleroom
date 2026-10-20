import type { ReactNode } from "react";

import { initials } from "../lib/format";
import { Card } from "../theme";
import type { SpeakerPicture } from "../types";

export default function SpeakerProfileMasthead({
  name,
  headerImage,
  profileImage,
  profileImageUrl,
  children,
}: {
  name: string;
  headerImage?: SpeakerPicture | null;
  profileImage?: SpeakerPicture | null;
  profileImageUrl?: string | null;
  children?: ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-profile-banner w-full bg-purple-soft">
        {headerImage && (
          <img
            src={
              headerImage.variants?.xl?.url ??
              headerImage.variants?.m?.url ??
              headerImage.url
            }
            alt={`${name} cover image`}
            className="h-full w-full object-cover"
          />
        )}
      </div>
      <div className="px-5 pb-6 sm:px-8 sm:pb-8">
        <div className="relative -mt-12 mb-5 sm:-mt-16">
          <div className="flex size-24 items-center justify-center overflow-hidden rounded-full border-4 border-surface bg-avatar-brand font-heading text-3xl text-white sm:size-32 sm:text-4xl">
            {profileImage || profileImageUrl ? (
              <img
                src={
                  profileImageUrl ??
                  profileImage?.variants?.s?.url ??
                  profileImage?.variants?.m?.url ??
                  profileImage?.url
                }
                alt={`${name} profile image`}
                className="h-full w-full object-cover"
              />
            ) : (
              <span aria-label={`${name} profile initials`}>
                {initials(name)}
              </span>
            )}
          </div>
        </div>
        {children ?? <p className="font-heading text-2xl">{name}</p>}
      </div>
    </Card>
  );
}
