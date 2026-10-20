import { useState } from "react";
import type { FormEvent } from "react";

import { api } from "../api";
import useMutation from "../hooks/useMutation";
import useSession from "../hooks/useSession";
import useUsernameAvailability from "../hooks/useUsernameAvailability";
import { PROFILE_LINKS, profileLinkValues } from "../lib/profile";
import { Button, Card, Field, Input, Notice, SectionHeader } from "../theme";
import type { Account, SpeakerInformation } from "../types";

export default function SpeakerProfileSettings({
  user,
  onDirty,
  onSaved,
}: {
  user: Account;
  onDirty: (dirty: boolean) => void;
  onSaved: (result: { user: Account; information: SpeakerInformation }) => void;
}) {
  const { refreshMe } = useSession();
  const [username, setUsername] = useState(user.username ?? "");
  const [links, setLinks] = useState(() => profileLinkValues(user));
  const [saved, setSaved] = useState(false);
  const mutation = useMutation();
  const availability = useUsernameAvailability(username, user.username);
  const usernameBlocked = ["invalid", "taken", "checking"].includes(
    availability.status
  );
  function changed() {
    setSaved(false);
    onDirty(true);
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (usernameBlocked) return;
    mutation.run(
      async () => {
        const result = await api<{ user: Account }>("/me", {
          method: "PATCH",
          body: {
            ...(username === (user.username ?? "")
              ? {}
              : { username: username || null }),
            ...Object.fromEntries(
              PROFILE_LINKS.map(({ field }) => [field, links[field] || null])
            ),
          },
        });
        const information = await api<SpeakerInformation>("/speaker");
        return { ...result, information };
      },
      (result) => {
        setUsername(result.user.username ?? "");
        setLinks(profileLinkValues(result.user));
        setSaved(true);
        onDirty(false);
        onSaved(result);
        refreshMe();
      }
    );
  }
  return (
    <section aria-label="Speaker identity and links">
      <SectionHeader title="Username, homepage and socials" />
      <Card padded>
        <form onSubmit={submit} className="space-y-5">
          <Field
            label="Username"
            hint="Optional. 4–40 lowercase letters or numbers with single dashes. Changing or clearing it unpublishes your press kit; the old URL stops working."
          >
            <Input
              value={username}
              minLength={username === user.username ? undefined : 4}
              maxLength={40}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              aria-invalid={
                availability.status === "invalid" ||
                availability.status === "taken"
              }
              onChange={(e) => {
                setUsername(e.target.value);
                availability.reset();
                mutation.setError(null);
                changed();
              }}
            />
            {availability.message && (
              <p
                role="status"
                data-testid="username-availability"
                className={
                  availability.status === "taken" ||
                  availability.status === "invalid"
                    ? "text-xs text-urgent-ink"
                    : availability.status === "available" ||
                        availability.status === "current"
                      ? "text-xs text-green-deep"
                      : "text-xs text-muted"
                }
              >
                {availability.message}
              </p>
            )}
          </Field>
          <p className="break-all text-sm text-muted">
            Public profile path: /u/{username || "your-username"}. Claiming a
            username does not publish anything.
          </p>
          <p className="text-sm text-muted">
            Homepage and socials are also shown on your signed-in member
            profile. All saved links appear on the open web when you turn on
            public sharing below. Use full HTTP(S) URLs; Mastodon supports any
            instance.
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
                    changed();
                  }}
                />
              </Field>
            ))}
          </div>
          {mutation.error && <Notice tone="error">{mutation.error}</Notice>}
          {saved && (
            <Notice tone="success">Your username and links are saved.</Notice>
          )}
          <Button
            type="submit"
            variant="primary"
            loading={mutation.busy}
            disabled={usernameBlocked}
          >
            Save username and links
          </Button>
        </form>
      </Card>
    </section>
  );
}
