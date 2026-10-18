import { useState } from "react";
import type { FormEvent } from "react";

import { api } from "../api";
import useMutation from "../hooks/useMutation";
import { Brand, Button, Card, Field, Input, Notice } from "../theme";

export default function ProfileOnboarding({
  onSaved,
}: {
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const mutation = useMutation();
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.run(
      () => api("/me", { method: "PATCH", body: { name } }),
      onSaved
    );
  }
  return (
    <main className="mx-auto max-w-lg space-y-8 px-6 py-16">
      <Brand />
      <Card padded>
        <h1 className="text-2xl">What should we call you?</h1>
        <p className="mt-2 text-sm text-muted">
          Choose a display name to join the member directory. Your email stays
          private.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-5">
          <Field label="Display name">
            <Input
              required
              maxLength={200}
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          {mutation.error && <Notice tone="error">{mutation.error}</Notice>}
          <Button type="submit" variant="primary" loading={mutation.busy}>
            Complete my profile
          </Button>
          <Button
            onClick={() =>
              mutation.run(
                () => api("/auth/logout", { method: "POST" }),
                () => window.location.assign("/login")
              )
            }
          >
            Sign out
          </Button>
        </form>
      </Card>
    </main>
  );
}
