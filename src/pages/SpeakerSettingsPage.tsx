import { useState } from "react";
import type { FormEvent } from "react";

import { api } from "../api";
import SpeakerBrandingSettings from "../components/SpeakerBrandingSettings";
import SpeakerPictureCard from "../components/SpeakerPictureCard";
import SpeakerProfileSettings from "../components/SpeakerProfileSettings";
import SpeakerPublication from "../components/SpeakerPublication";
import SpeakerSharingImage from "../components/SpeakerSharingImage";
import useApi from "../hooks/useApi";
import useMutation from "../hooks/useMutation";
import useSession from "../hooks/useSession";
import {
  Button,
  ButtonLink,
  Card,
  Field,
  Input,
  LoadingState,
  Notice,
  PageHeader,
  SectionHeader,
  Select,
  SegmentedControl,
  Textarea,
} from "../theme";
import type { SpeakerDraft, SpeakerInformation } from "../types";

function SpeakerEditor({ initial }: { initial: SpeakerInformation }) {
  const { user } = useSession();
  const [account, setAccount] = useState(user);
  const [profileDirty, setProfileDirty] = useState(false);
  const [brandingDirty, setBrandingDirty] = useState(false);
  const [information, setInformation] = useState(initial);
  const [draft, setDraft] = useState<SpeakerDraft>(initial.draft);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [publicationKey, setPublicationKey] = useState(0);
  const [picture, setPicture] = useState({
    source_url: "",
    label: "",
    credit: "",
  });
  const mutation = useMutation();
  const [pictureSource, setPictureSource] = useState<"file" | "url">("file");
  const [pictureFile, setPictureFile] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  function change(next: SpeakerDraft) {
    setDraft(next);
    setDirty(true);
    setSaved(false);
  }
  function received(data: SpeakerInformation) {
    setInformation(data);
    setPublicationKey((k) => k + 1);
  }
  function save(event: FormEvent) {
    event.preventDefault();
    mutation.run(
      () => api<SpeakerInformation>("/speaker", { method: "PUT", body: draft }),
      (data) => {
        received(data);
        setDraft(data.draft);
        setDirty(false);
        setSaved(true);
      }
    );
  }
  return (
    <div className="max-w-4xl space-y-9">
      <PageHeader
        title="Speaker settings"
        description="Edit your speaker information and control public sharing. Saving never publishes anything automatically."
      />
      <ButtonLink to="/speaker">Open speaker toolkit</ButtonLink>
      <SpeakerProfileSettings
        user={account}
        onDirty={setProfileDirty}
        onSaved={(result) => {
          setAccount(result.user);
          received(result.information);
        }}
      />
      <section aria-label="Speaker information">
        <SectionHeader title="Speaker information" />
        <Card padded>
          <form onSubmit={save} className="space-y-5">
            {(
              [
                ["tagline", "Tagline"],
                ["company", "Company"],
                ["job_title", "Job title"],
                ["contact_email", "Public contact email"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <Field
                  label={label}
                  hint={
                    key === "contact_email"
                      ? "Optional contact address included when your speaker profile is public, never filled from your login email."
                      : undefined
                  }
                >
                  <Input
                    type={key === "contact_email" ? "email" : "text"}
                    maxLength={200}
                    value={draft[key]}
                    onChange={(e) =>
                      change({ ...draft, [key]: e.target.value })
                    }
                  />
                </Field>
              </div>
            ))}
            <div className="border-t border-divider pt-5">
              <h3 className="text-xl">Bio variants</h3>
              <p className="my-3 text-sm text-muted">
                Name each version, for example Short, Long, or Deutsch. Edit the
                text directly.
              </p>
              <div className="space-y-5">
                {draft.bios.map((bio, i) => (
                  <fieldset
                    className="space-y-3 rounded-xl border border-border p-4"
                    key={i}
                  >
                    <legend className="px-2 text-sm">Bio {i + 1}</legend>
                    <Field label={`Bio ${i + 1} label`}>
                      <Input
                        required
                        maxLength={200}
                        value={bio.label}
                        onChange={(e) =>
                          change({
                            ...draft,
                            bios: draft.bios.map((b, j) =>
                              j === i ? { ...b, label: e.target.value } : b
                            ),
                          })
                        }
                      />
                    </Field>
                    <Field label={`Bio ${i + 1} text`}>
                      <Textarea
                        required
                        maxLength={20000}
                        rows={6}
                        value={bio.text}
                        onChange={(e) =>
                          change({
                            ...draft,
                            bios: draft.bios.map((b, j) =>
                              j === i ? { ...b, text: e.target.value } : b
                            ),
                          })
                        }
                      />
                    </Field>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() =>
                          change({
                            ...draft,
                            bios: draft.bios.filter((_, j) => j !== i),
                          })
                        }
                      >
                        Remove bio {i + 1}
                      </Button>
                    </div>
                  </fieldset>
                ))}
              </div>
              <Button
                className="mt-4"
                disabled={draft.bios.length >= 20}
                onClick={() =>
                  change({
                    ...draft,
                    bios: [...draft.bios, { label: "", text: "" }],
                  })
                }
              >
                Add bio variant
              </Button>
            </div>
            <div className="border-t border-divider pt-5">
              <h3 className="text-xl">
                Talks, recordings, slides and appearances
              </h3>
              <p className="my-3 text-sm text-muted">
                Add deliberately shareable work here. Private proposals and
                submissions are never imported or published.
              </p>
              <div className="space-y-5">
                {draft.appearances.map((entry, i) => (
                  <fieldset
                    key={i}
                    className="space-y-3 rounded-xl border border-border p-4"
                  >
                    <legend className="px-2 text-sm">Work {i + 1}</legend>
                    <Field label={`Work ${i + 1} kind`}>
                      <Select
                        value={entry.kind}
                        onChange={(e) =>
                          change({
                            ...draft,
                            appearances: draft.appearances.map((a, j) =>
                              j === i
                                ? {
                                    ...a,
                                    kind: e.target.value as typeof entry.kind,
                                  }
                                : a
                            ),
                          })
                        }
                      >
                        {["talk", "recording", "slides", "appearance"].map(
                          (kind) => (
                            <option key={kind}>{kind}</option>
                          )
                        )}
                      </Select>
                    </Field>
                    {(["title", "url", "description"] as const).map((key) => (
                      <div key={key}>
                        <Field label={`Work ${i + 1} ${key}`}>
                          <Input
                            required={key !== "description"}
                            type={key === "url" ? "url" : "text"}
                            maxLength={
                              key === "url"
                                ? 2048
                                : key === "description"
                                  ? 2000
                                  : 200
                            }
                            value={entry[key]}
                            onChange={(e) =>
                              change({
                                ...draft,
                                appearances: draft.appearances.map((a, j) =>
                                  j === i ? { ...a, [key]: e.target.value } : a
                                ),
                              })
                            }
                          />
                        </Field>
                      </div>
                    ))}
                    <Button
                      onClick={() =>
                        change({
                          ...draft,
                          appearances: draft.appearances.filter(
                            (_, j) => j !== i
                          ),
                        })
                      }
                    >
                      Remove work {i + 1}
                    </Button>
                  </fieldset>
                ))}
              </div>
              <Button
                className="mt-4"
                disabled={draft.appearances.length >= 50}
                onClick={() =>
                  change({
                    ...draft,
                    appearances: [
                      ...draft.appearances,
                      { kind: "talk", title: "", url: "", description: "" },
                    ],
                  })
                }
              >
                Add work
              </Button>
            </div>
            {saved && (
              <Notice tone="success">
                Your speaker information is saved. Public sharing is unchanged.
              </Notice>
            )}
            <Button type="submit" variant="primary" loading={mutation.busy}>
              Save speaker information
            </Button>
          </form>
        </Card>
      </section>
      <section aria-label="Speaker pictures">
        <SectionHeader title="Speaker pictures" />
        <p className="mb-4 text-sm text-muted">
          Up to ten PNG, JPEG, WebP or AVIF photos, 5 MB and 20 megapixels each,
          at least 2000 pixels wide. Saving generates S (400px), M (720px), L
          (1080px), XL (1900px) and Full at their original aspect ratio. All
          saved pictures have public, unguessable URLs that work without
          sign-in, even when your speaker profile is private. Full retains the
          original file and its metadata.
        </p>
        <div className="mb-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {information.pictures.map((image) => (
            <SpeakerPictureCard key={image.id} picture={image}>
              <Button
                loading={mutation.busy}
                onClick={() =>
                  mutation.run(
                    () =>
                      api<SpeakerInformation>(`/speaker/pictures/${image.id}`, {
                        method: "DELETE",
                      }),
                    received
                  )
                }
              >
                Remove {image.label}
              </Button>
            </SpeakerPictureCard>
          ))}
        </div>
        <Card padded>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.run(
                () => {
                  if (pictureSource === "url")
                    return api<SpeakerInformation>("/speaker/pictures", {
                      method: "POST",
                      body: picture,
                    });
                  if (!pictureFile)
                    throw new Error("Choose a picture to upload.");
                  if (pictureFile.size > 5 * 1024 * 1024)
                    throw new Error(
                      "Speaker pictures must be no larger than 5 MB."
                    );
                  const data = new FormData();
                  data.append("picture", pictureFile);
                  data.append("label", picture.label);
                  data.append("credit", picture.credit);
                  return api<SpeakerInformation>("/speaker/pictures", {
                    method: "POST",
                    body: data,
                  });
                },
                (data) => {
                  received(data);
                  setPicture({ source_url: "", label: "", credit: "" });
                  setPictureFile(null);
                  setFileInputKey((key) => key + 1);
                }
              );
            }}
          >
            <SegmentedControl
              label="Picture source"
              value={pictureSource}
              options={[
                { value: "file", label: "Upload a file" },
                { value: "url", label: "Import from URL" },
              ]}
              onChange={setPictureSource}
            />
            {pictureSource === "file" ? (
              <Field
                label="Speaker picture file"
                hint="At least 2000 pixels wide. PNG, JPEG, WebP or AVIF, up to 5 MB."
              >
                <Input
                  key={fileInputKey}
                  type="file"
                  required
                  accept="image/png,image/jpeg,image/webp,image/avif"
                  onChange={(event) =>
                    setPictureFile(event.target.files?.[0] ?? null)
                  }
                />
              </Field>
            ) : (
              <Field
                label="Speaker picture URL"
                hint="Downloaded and resized on save, never hotlinked as a preview."
              >
                <Input
                  type="url"
                  required
                  maxLength={2048}
                  value={picture.source_url}
                  onChange={(e) =>
                    setPicture({ ...picture, source_url: e.target.value })
                  }
                />
              </Field>
            )}
            <Field label="Picture label">
              <Input
                required
                maxLength={200}
                value={picture.label}
                onChange={(e) =>
                  setPicture({ ...picture, label: e.target.value })
                }
              />
            </Field>
            <Field label="Picture credit and usage instructions">
              <Textarea
                maxLength={1000}
                value={picture.credit}
                onChange={(e) =>
                  setPicture({ ...picture, credit: e.target.value })
                }
              />
            </Field>
            <Button
              type="submit"
              loading={mutation.busy}
              disabled={information.pictures.length >= 10}
            >
              Save picture
            </Button>
          </form>
        </Card>
        <p className="mt-3 text-sm text-muted">
          Removing a published picture also unpublishes the press kit. Retained
          files are removed when you delete your account.
        </p>
      </section>
      {mutation.error && <Notice tone="error">{mutation.error}</Notice>}
      <SpeakerBrandingSettings
        information={information}
        name={account.name}
        onDirty={setBrandingDirty}
        onSaved={received}
      />
      <SpeakerPublication
        key={publicationKey}
        information={information}
        hasUnsavedChanges={dirty || profileDirty || brandingDirty}
        onSaved={setInformation}
      />
      {information.sharing && (
        <SpeakerSharingImage sharing={information.sharing} />
      )}
    </div>
  );
}

export default function SpeakerSettingsPage() {
  const { data, error, loading } = useApi<SpeakerInformation>("/speaker");
  if (loading) return <LoadingState />;
  if (error || !data) return <Notice tone="error">{error}</Notice>;
  return <SpeakerEditor initial={data} />;
}
