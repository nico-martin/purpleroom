import { Check, Copy, Download } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import {
  copySpeakerPicture,
  pictureFileSize,
  SPEAKER_PICTURE_SIZES,
} from "../lib/speaker-pictures";
import { Button, Card, CopyButton, Notice, SegmentedControl } from "../theme";
import type { SpeakerPicture, SpeakerPictureSize } from "../types";

export default function SpeakerPictureCard({
  picture,
  children,
}: {
  picture: SpeakerPicture;
  children?: ReactNode;
}) {
  const [size, setSize] = useState<SpeakerPictureSize>("full");
  const [busy, setBusy] = useState(false);
  const [copiedSize, setCopiedSize] = useState<SpeakerPictureSize | null>(null);
  const [error, setError] = useState("");
  const selected = picture.variants?.[size];
  const url = selected?.url ?? picture.url;
  const previewUrl = picture.variants?.m?.url ?? picture.url;
  const downloadUrl = selected?.download_url ?? picture.download_url;
  const options = SPEAKER_PICTURE_SIZES.filter(
    (option) => option.value === "full" || picture.variants?.[option.value]
  );
  const absoluteUrl = new URL(url, window.location.origin).href;
  async function copyImage() {
    setBusy(true);
    setError("");
    setCopiedSize(null);
    try {
      await copySpeakerPicture(url);
      setCopiedSize(size);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "The image could not be copied."
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <article aria-label={`Picture: ${picture.label}`}>
      <Card className="overflow-hidden">
        <div className="aspect-landscape w-full bg-image-matte">
          <img
            src={previewUrl}
            alt={picture.label}
            className="h-full w-full object-contain"
          />
        </div>
        <div className="space-y-5 p-5">
          <div>
            <h3 className="text-lg">{picture.label}</h3>
            {picture.credit && (
              <CopyButton
                appearance="text"
                value={picture.credit}
                label={`${picture.label} credit and usage instructions`}
                tone="muted"
              />
            )}
          </div>
          <div className="space-y-2">
            <p className="font-mono text-xs uppercase tracking-widest text-muted">
              Size
            </p>
            <SegmentedControl
              label={`Size for ${picture.label}`}
              value={size}
              options={options}
              disabled={busy}
              className="w-full"
              compact
              onChange={(value) => {
                setSize(value);
                setError("");
              }}
            />
          </div>
          <dl className="grid grid-cols-3 divide-x divide-border border-t border-border pt-4 text-sm">
            <div className="min-w-0 pr-2">
              <dt className="text-xs text-muted">File size</dt>
              <dd className="mt-1 whitespace-nowrap font-mono text-xs leading-5">
                {selected ? pictureFileSize(selected.file_size) : "—"}
              </dd>
            </div>
            <div className="min-w-0 px-2">
              <dt className="text-xs text-muted">Width</dt>
              <dd className="mt-1 whitespace-nowrap font-mono text-xs leading-5">
                {selected?.width ? `${selected.width}px` : "—"}
              </dd>
            </div>
            <div className="min-w-0 pl-2">
              <dt className="text-xs text-muted">Height</dt>
              <dd className="mt-1 whitespace-nowrap font-mono text-xs leading-5">
                {selected?.height ? `${selected.height}px` : "—"}
              </dd>
            </div>
          </dl>
          <a
            href={downloadUrl}
            aria-label={`Download ${picture.label}`}
            className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green px-4 py-3 text-sm font-semibold text-on-purple hover:bg-green-deep"
          >
            <Download size={16} aria-hidden="true" />
            Download
          </a>
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={copyImage}
              compact
              loading={busy}
              aria-label={`Copy image: ${picture.label}`}
            >
              {!busy &&
                (copiedSize === size ? (
                  <Check size={15} aria-hidden="true" />
                ) : (
                  <Copy size={15} aria-hidden="true" />
                ))}
              {copiedSize === size ? "Copied" : "Copy image"}
            </Button>
            <CopyButton
              value={absoluteUrl}
              compact
              label={`image URL: ${picture.label}`}
            >
              Copy URL
            </CopyButton>
          </div>
          <span className="sr-only" role="status">
            {copiedSize === size ? `${picture.label} image copied.` : ""}
          </span>
          {error && <Notice tone="error">{error}</Notice>}
          {children}
        </div>
      </Card>
    </article>
  );
}
