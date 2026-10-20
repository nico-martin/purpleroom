import { useState } from "react";

import { Button, Card, Notice, SectionHeader } from "../theme";
import type { SpeakerSharing } from "../types";

function rebuildUrl(url: string, nonce: number) {
  // Shareable ignores unknown parameters in its cache key; the nonce only
  // bypasses the browser's copy of the previous image.
  return `${url}&rebuild=true&t=${nonce}`;
}

export default function SpeakerSharingImage({
  sharing,
}: {
  sharing: SpeakerSharing;
}) {
  const [rebuild, setRebuild] = useState<{ url: string; nonce: number }>();
  const [state, setState] = useState<{
    src: string;
    status: "loaded" | "failed";
  }>();
  const src =
    rebuild?.url === sharing.image_url
      ? rebuildUrl(sharing.image_url, rebuild.nonce)
      : sharing.image_url;
  const status = state?.src === src ? state.status : "loading";
  function regenerate() {
    const nonce = Date.now();
    setRebuild({ url: sharing.image_url, nonce });
    // Rebuild the Twitter format too, so both cached images stay in sync.
    const twitter = new Image();
    twitter.referrerPolicy = "no-referrer";
    twitter.src = rebuildUrl(sharing.twitter_image_url, nonce);
  }
  return (
    <section aria-label="Social sharing image" className="space-y-4">
      <SectionHeader title="Social sharing image" />
      <Card padded className="space-y-4">
        <p className="text-sm text-muted">
          Social platforms show this image when someone shares your public press
          kit. It uses only your published name, portrait, cover and tagline,
          and is rendered by shareable.nico.dev. Regenerate it if the image
          looks outdated or failed to render; use “Update public profile” first
          to include newer saved information.
        </p>
        <div className="aspect-social-card overflow-hidden rounded-xl bg-image-matte">
          {status !== "failed" && (
            <img
              key={src}
              src={src}
              alt="Published speaker profile sharing image"
              referrerPolicy="no-referrer"
              onLoad={() => setState({ src, status: "loaded" })}
              onError={() => setState({ src, status: "failed" })}
              className="h-full w-full object-contain"
            />
          )}
        </div>
        {status === "failed" && (
          <Notice tone="error">
            Could not load the sharing image. Check that Shareable is running
            and allows your publicly reachable site, then regenerate it.
          </Notice>
        )}
        <Button loading={status === "loading"} onClick={regenerate}>
          Regenerate image
        </Button>
      </Card>
    </section>
  );
}
