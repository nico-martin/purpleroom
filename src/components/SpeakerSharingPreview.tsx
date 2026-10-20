import { useState } from "react";

import {
  Button,
  ButtonLink,
  Card,
  CopyButton,
  Notice,
  SectionHeader,
} from "../theme";
import type { SpeakerSharing } from "../types";

export default function SpeakerSharingPreview({
  sharing,
}: {
  sharing?: SpeakerSharing | null;
}) {
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return (
    <section aria-label="Social sharing preview" className="space-y-4">
      <SectionHeader title="Social sharing preview" />
      <Card padded className="space-y-4">
        {sharing ? (
          <>
            <p className="text-sm text-muted">
              Your public press kit has a preview image for social links. It
              uses only your published name, portrait, cover and tagline—not
              unsaved or private toolkit information.
            </p>
            <p className="text-sm text-muted">
              Loading the preview contacts shareable.nico.dev with your public
              profile URL. The renderer must be able to reach your site;
              localhost profiles cannot be rendered by this instance. Shareable
              and social platforms may keep cached copies after you unpublish.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                onClick={() => {
                  setFailedUrl(null);
                  setLoadedUrl(sharing.image_url);
                }}
              >
                Load sharing preview
              </Button>
              <ButtonLink
                to={sharing.profile_url}
                target="_blank"
                rel="noreferrer"
              >
                Open public press kit
              </ButtonLink>
              <CopyButton
                value={sharing.profile_url}
                label="public profile URL"
              />
              <CopyButton value={sharing.image_url} label="sharing image URL" />
            </div>
            {loadedUrl === sharing.image_url &&
              failedUrl !== sharing.image_url && (
                <img
                  src={sharing.image_url}
                  alt="Published speaker profile sharing preview"
                  referrerPolicy="no-referrer"
                  onError={() => setFailedUrl(sharing.image_url)}
                  className="w-full rounded-xl"
                />
              )}
            {failedUrl === sharing.image_url && (
              <Notice tone="error">
                Could not load the sharing preview. Check that Shareable is
                running and allows your publicly reachable site, then try again.
              </Notice>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">
            Publish your press kit in Speaker settings to create a social
            sharing preview. Private drafts are never sent to Shareable.
          </p>
        )}
      </Card>
    </section>
  );
}
