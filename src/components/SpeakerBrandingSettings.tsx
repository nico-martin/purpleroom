import { useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";

import { api } from "../api";
import useMutation from "../hooks/useMutation";
import { prepareSpeakerCover } from "../lib/speaker-cover";
import { Button, Card, Field, Input, Notice, SectionHeader } from "../theme";
import type { SpeakerInformation } from "../types";
import SpeakerProfileMasthead from "./SpeakerProfileMasthead";

export default function SpeakerBrandingSettings({
  information,
  name,
  onDirty,
  onSaved,
}: {
  information: SpeakerInformation;
  name: string;
  onDirty: (dirty: boolean) => void;
  onSaved: (information: SpeakerInformation) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [saved, setSaved] = useState(false);
  const mutation = useMutation();
  function received(result: SpeakerInformation) {
    setFile(null);
    setInputKey((key) => key + 1);
    setSaved(true);
    onDirty(false);
    onSaved(result);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    mutation.run(async () => {
      const cover = await prepareSpeakerCover(file);
      const body = new FormData();
      body.append("picture", cover);
      return api<SpeakerInformation>("/speaker/branding/header", {
        method: "POST",
        body,
      });
    }, received);
  }
  return (
    <section className="space-y-5" aria-label="Press-kit images">
      <SectionHeader title="Press-kit cover and profile picture" />
      <Card padded>
        <p className="mb-5 text-sm text-muted">
          Your portrait uses your Purple Room profile picture. Change it in{" "}
          <Link to="/settings" className="underline">
            General Settings
          </Link>
          . Publishing or updating your public profile includes a copy of that
          picture; later profile-picture changes are not published
          automatically.
        </p>
        <form onSubmit={submit} className="space-y-5">
          <Field
            label="Header image"
            hint="Choose a PNG, JPEG, WebP or AVIF image, at least 800 × 200 pixels. Your browser centre-crops and resizes it to fit (up to 1600 × 400) before uploading; large originals stay on your device. The prepared upload must fit within 5 MB. This cover is separate from your speaker-picture gallery."
          >
            <Input
              key={inputKey}
              type="file"
              required
              accept="image/png,image/jpeg,image/webp,image/avif"
              disabled={mutation.busy}
              onChange={(event) => {
                const selected = event.target.files?.[0] ?? null;
                setFile(selected);
                mutation.setError(null);
                setSaved(false);
                onDirty(!!event.target.files?.length);
              }}
            />
          </Field>
          {mutation.error && <Notice tone="error">{mutation.error}</Notice>}
          {mutation.busy && (
            <p role="status" className="text-sm text-muted">
              Preparing and uploading your cover…
            </p>
          )}
          {saved && (
            <Notice tone="success">
              Your cover is saved. Public sharing is unchanged.
            </Notice>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              type="submit"
              variant="primary"
              loading={mutation.busy}
              disabled={!file}
            >
              Save cover image
            </Button>
            {information.branding?.header_image && (
              <Button
                disabled={mutation.busy}
                onClick={() =>
                  mutation.run(
                    () =>
                      api<SpeakerInformation>("/speaker/branding/header", {
                        method: "DELETE",
                      }),
                    received
                  )
                }
              >
                Remove cover image
              </Button>
            )}
          </div>
        </form>
      </Card>
      <SpeakerProfileMasthead
        name={name}
        headerImage={information.branding?.header_image}
        profileImageUrl={information.branding?.profile_url}
      />
    </section>
  );
}
