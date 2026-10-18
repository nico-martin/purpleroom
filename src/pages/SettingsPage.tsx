import { Save } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { api } from "../api";
import useMutation from "../hooks/useMutation";
import useSession from "../hooks/useSession";
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

export default function SettingsPage({
  className = "",
}: {
  className?: string;
}) {
  const { user, refreshMe } = useSession();
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar_url ?? "");
  const [saved, setSaved] = useState(false);
  const mutation = useMutation();
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.run(
      () =>
        api("/me", {
          method: "PATCH",
          body: { name, avatar_url: avatar || null },
        }),
      () => {
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
              <Avatar name={name || user.name} src={avatar} size="lg" />
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
            <Field
              label="Avatar URL (optional)"
              hint="No image? Initials look good on you, too."
            >
              <Input
                type="url"
                value={avatar}
                onChange={(e) => {
                  setAvatar(e.target.value);
                  setSaved(false);
                }}
                placeholder="https://…"
              />
            </Field>
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
    </div>
  );
}
