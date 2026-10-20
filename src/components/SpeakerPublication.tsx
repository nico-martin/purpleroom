import { useState } from "react";

import { api } from "../api";
import useMutation from "../hooks/useMutation";
import {
  Button,
  ButtonLink,
  Card,
  Switch,
  Notice,
  SectionHeader,
} from "../theme";
import type { SpeakerInformation, SpeakerProfile } from "../types";
import SpeakerProfileView from "./SpeakerProfileView";

export default function SpeakerPublication({
  information,
  onSaved,
  hasUnsavedChanges = false,
}: {
  information: SpeakerInformation;
  onSaved: (data: SpeakerInformation) => void;
  hasUnsavedChanges?: boolean;
}) {
  const [preview, setPreview] = useState<SpeakerProfile | null>(null);
  const [message, setMessage] = useState("");
  const mutation = useMutation();
  function saved(data: SpeakerInformation) {
    onSaved(data);
    setPreview(null);
    setMessage(
      data.published
        ? "Your complete speaker profile is now public."
        : "Your profile is now private."
    );
  }
  function publish() {
    setMessage("");
    if (hasUnsavedChanges) {
      mutation.setError(
        "Save your changes above before publishing your speaker profile."
      );
      return;
    }
    mutation.run(
      () =>
        api<SpeakerInformation>("/speaker/publication", {
          method: "PUT",
          body: { publish_all: true },
        }),
      saved
    );
  }
  return (
    <section className="space-y-5" aria-label="Public speaker profile">
      <SectionHeader title="Your public speaker profile" />
      <Notice>
        Off by default. Turning this on publishes all saved speaker-profile
        information: your name, tagline, company, job title, public contact
        email, every bio, homepage/social link, speaker picture and saved talk
        or appearance. Your login email, private proposals, submissions and crew
        data are never included.
      </Notice>
      <p className="text-sm">
        Status:{" "}
        <strong>{information.published ? "Published" : "Private"}</strong>
      </p>
      <Switch
        label="Make my profile public"
        checked={information.published}
        disabled={mutation.busy}
        onChange={() => {
          setMessage("");
          if (information.published)
            mutation.run(
              () =>
                api<SpeakerInformation>("/speaker/publication", {
                  method: "DELETE",
                }),
              saved
            );
          else publish();
        }}
      />
      <p className="text-sm text-muted">
        No preview or individual sharing choices are required. Turning this off
        revokes public profile access immediately. Picture URLs stay public
        until the picture is removed or your account is suspended or deleted.
        Downloaded or third-party cached copies cannot be recalled.
      </p>
      {!information.username && (
        <Notice>
          Save a username above before making your profile public at
          /u/your-username.
        </Notice>
      )}
      {hasUnsavedChanges && (
        <Notice>
          Save your changes above before publishing or updating your public
          profile. You can still turn public sharing off.
        </Notice>
      )}
      <div className="flex flex-wrap gap-3">
        {information.published && (
          <>
            <ButtonLink to={`/u/${information.username}`}>
              View public profile
            </ButtonLink>
            <Button loading={mutation.busy} onClick={publish}>
              Update public profile
            </Button>
          </>
        )}
        <Button
          loading={mutation.busy}
          onClick={() => {
            if (hasUnsavedChanges) {
              mutation.setError(
                "Save your changes above before previewing your speaker profile."
              );
              return;
            }
            mutation.run(
              () =>
                api<{ profile: SpeakerProfile }>("/speaker/preview", {
                  method: "POST",
                }),
              (result) => setPreview(result.profile)
            );
          }}
        >
          Preview public profile
        </Button>
      </div>
      <p className="text-sm text-muted">
        Saving edits does not change an already-published profile. Use “Update
        public profile” to publish all your latest saved information.
      </p>
      {mutation.error && <Notice tone="error">{mutation.error}</Notice>}
      {message && <Notice tone="success">{message}</Notice>}
      {preview && !hasUnsavedChanges && (
        <Card padded className="space-y-6">
          <Notice>
            This optional preview is private. Turning on “Make my profile
            public” publishes all saved speaker-profile information.
          </Notice>
          <SpeakerProfileView profile={preview} />
        </Card>
      )}
    </section>
  );
}
