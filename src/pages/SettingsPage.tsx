import { CalendarDays, RefreshCw, Save } from "lucide-react";
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
  CopyField,
  Field,
  Input,
  Notice,
  PageHeader,
  SectionHeader,
} from "../theme";

interface SettingsPageProps {
  className?: string;
}
export default function SettingsPage({ className = "" }: SettingsPageProps) {
  const { user, cal_url, refreshMe } = useSession();
  const [name, setName] = useState(user.name);
  const [avatar, setAvatar] = useState(user.avatar_url ?? "");
  const [calendar, setCalendar] = useState(cal_url);
  const [saved, setSaved] = useState(false);
  const profile = useMutation();
  const token = useMutation();
  function submit(event: FormEvent) {
    event.preventDefault();
    profile.run(
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
        eyebrow="Make yourself at home"
        title="The little details."
        description="Your profile, your calendar, your corner of the room."
      />
      <section className="mb-9 max-w-5xl">
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
      <div className="grid max-w-5xl gap-9 lg:grid-cols-2">
        <section>
          <SectionHeader title="How the crew sees you" />
          <Card padded>
            <form onSubmit={submit} className="space-y-5">
              <div className="mb-6 flex items-center gap-4">
                <Avatar name={name || user.name} src={avatar} size="lg" />
                <div>
                  <p className="font-heading text-lg">{name || user.name}</p>
                  <p className="text-xs text-muted">{user.email}</p>
                </div>
              </div>
              <Field label="Your name">
                <Input
                  required
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
              {profile.error && <Notice tone="error">{profile.error}</Notice>}
              {saved && (
                <Notice tone="success">
                  Looking good. Your profile is saved.
                </Notice>
              )}
              <div className="flex justify-end border-t border-divider pt-5">
                <Button type="submit" variant="primary" loading={profile.busy}>
                  <Save size={15} />
                  Save profile
                </Button>
              </div>
            </form>
          </Card>
        </section>
        <section>
          <SectionHeader title="A nudge from your calendar" />
          <Card padded>
            <span className="mb-5 flex size-11 items-center justify-center rounded-xl bg-green-soft text-green">
              <CalendarDays size={22} strokeWidth={1.5} />
            </span>
            <h3 className="text-lg">Keep the good dates close.</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Subscribe in your calendar app to see upcoming CFP deadlines, plus
              conferences you're speaking at or going to.
            </p>
            <Field label="Your private calendar feed" className="mt-6">
              <CopyField
                key={calendar}
                value={calendar}
                label="calendar feed URL"
              />
            </Field>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              Add it as a calendar subscription, not a one-off import. Anyone
              with this link can read your calendar, so keep it to yourself.
            </p>
            {token.error && (
              <Notice tone="error" className="mt-4">
                {token.error}
              </Notice>
            )}
            <div className="mt-6 border-t border-divider pt-4">
              <Button
                variant="ghost"
                loading={token.busy}
                className="-ml-4 text-xs"
                onClick={() => {
                  if (
                    confirm(
                      "Replace your calendar link? The old link will stop working and you'll need to subscribe again."
                    )
                  )
                    token.run(
                      () =>
                        api<{ cal_url: string }>("/me/cal-token", {
                          method: "POST",
                        }),
                      (result) => {
                        setCalendar(result.cal_url);
                        refreshMe();
                      }
                    );
                }}
              >
                <RefreshCw size={14} />
                Replace calendar link
              </Button>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}
