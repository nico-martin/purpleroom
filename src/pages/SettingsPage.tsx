import { Save, Trash2, X } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { api } from "../api";
import DeleteAccountDialog from "../components/DeleteAccountDialog";
import useMutation from "../hooks/useMutation";
import useSession from "../hooks/useSession";
import { PROFILE_LINKS, profileLinkValues } from "../lib/profile";
import {
  Avatar,
  Button,
  Card,
  ColorSchemeControl,
  Field,
  Input,
  Notice,
  PageHeader,
  SectionHeader,
} from "../theme";
import type { Account } from "../types";

export default function SettingsPage({
  className = "",
}: {
  className?: string;
}) {
  const { user, refreshMe } = useSession();
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar_url ?? "");
  const [links, setLinks] = useState(() => profileLinkValues(user));
  const storedAvatar = avatar.startsWith("/api/avatars/");
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const mutation = useMutation();
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.run(
      () =>
        api<{ user: Account }>("/me", {
          method: "PATCH",
          body: {
            name,
            avatar_url: avatar || null,
            ...Object.fromEntries(
              PROFILE_LINKS.map(({ field }) => [field, links[field] || null])
            ),
          },
        }),
      (result) => {
        setAvatar(result.user.avatar_url ?? "");
        setLinks(profileLinkValues(result.user));
        setSaved(true);
        refreshMe();
      }
    );
  }
  return (
    <div className={className}>
      <PageHeader
        title="The little details."
        description="Your profile, your corner of the room."
      />
      <section className="mb-9 max-w-3xl">
        <SectionHeader title="Set the mood" />
        <Card
          padded
          className="flex flex-wrap items-center justify-between gap-5"
        >
          <div>
            <h3 className="text-lg">Light, dark, or let your system decide.</h3>
            <p className="mt-2 text-sm text-muted">
              Saved in a cookie for this browser only, not to your account.
            </p>
          </div>
          <ColorSchemeControl />
        </Card>
      </section>
      <section className="max-w-3xl">
        <SectionHeader title="How members see you" />
        <Card padded>
          <form onSubmit={submit} className="space-y-5">
            <div className="flex items-center gap-4">
              <Avatar
                name={name || user.name}
                src={storedAvatar ? avatar : avatar ? user.avatar_url : null}
                size="lg"
              />
              <div>
                <p className="font-heading text-lg">{name || user.name}</p>
                <p className="text-xs text-muted">{user.email} · private</p>
              </div>
            </div>
            <Field label="Your name">
              <Input
                required
                maxLength={200}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSaved(false);
                }}
                autoComplete="name"
              />
            </Field>
            {avatar && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
                <p className="text-sm text-muted">
                  {storedAvatar
                    ? "Stored with purpleroom"
                    : "Image will be downloaded when you save."}
                </p>
                <Button
                  variant="ghost"
                  aria-label="Remove profile image"
                  onClick={() => {
                    setAvatar("");
                    setSaved(false);
                  }}
                >
                  <X size={15} />
                  Remove image
                </Button>
              </div>
            )}
            <Field
              label={
                storedAvatar
                  ? "Replace profile image from URL (optional)"
                  : "Avatar URL (optional)"
              }
              hint="Downloaded on save and stored with purpleroom. PNG, JPEG, GIF, WebP, AVIF, ICO or sanitised SVG, up to 5 MB. No image? We'll use initials."
            >
              <Input
                type="url"
                value={storedAvatar ? "" : avatar}
                onChange={(e) => {
                  setAvatar(e.target.value);
                  setSaved(false);
                }}
                placeholder="https://…"
              />
            </Field>
            <div className="space-y-5 border-t border-divider pt-5">
              <h3 className="text-lg">Homepage and socials</h3>
              <p className="text-sm text-muted">
                Optional links shown on your profile to signed-in members. Enter
                full URLs; Mastodon supports any instance.
              </p>
              <div className="grid gap-5 sm:grid-cols-2">
                {PROFILE_LINKS.map(({ field, label, placeholder }) => (
                  <Field key={field} label={label}>
                    <Input
                      type="url"
                      maxLength={2048}
                      value={links[field]}
                      placeholder={placeholder}
                      onChange={(e) => {
                        setLinks((current) => ({
                          ...current,
                          [field]: e.target.value,
                        }));
                        setSaved(false);
                      }}
                    />
                  </Field>
                ))}
              </div>
            </div>
            {mutation.error && <Notice tone="error">{mutation.error}</Notice>}
            {saved && (
              <Notice tone="success">
                Looking good. Your profile is saved.
              </Notice>
            )}
            <Button type="submit" variant="primary" loading={mutation.busy}>
              <Save size={15} />
              Save profile
            </Button>
          </form>
        </Card>
      </section>
      <section className="mt-9 max-w-3xl" aria-label="Danger">
        <SectionHeader title="Danger" />
        <Card padded className="border-urgent-ink/30">
          <h3 className="text-lg text-urgent-ink">
            Delete your account permanently
          </h3>
          <p className="mt-2 text-sm text-muted">
            This cannot be undone. Your account and all personal content will be
            deleted. Shared conferences and editions you created will remain,
            without your attribution.
          </p>
          {user.role === "admin" && (
            <p className="mt-3 text-sm text-muted">
              If you are the last active admin, appoint another active admin
              before deleting your account.
            </p>
          )}
          <Button
            variant="danger"
            className="mt-5"
            onClick={() => setDeleting(true)}
          >
            <Trash2 size={15} /> Delete my account
          </Button>
        </Card>
      </section>
      {deleting && <DeleteAccountDialog onClose={() => setDeleting(false)} />}
    </div>
  );
}
