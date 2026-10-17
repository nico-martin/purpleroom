import { ArrowRight, KeyRound, ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api";
import useMutation from "../hooks/useMutation";
import {
  Brand,
  Button,
  ButtonLink,
  Card,
  ColorSchemeControl,
  Field,
  Input,
  Notice,
  PageHeader,
} from "../theme";

interface SetupPageProps {
  className?: string;
}

export default function SetupPage({ className = "" }: SetupPageProps) {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [key, setKey] = useState("");
  const { busy, error, run } = useMutation();

  function submit(event: FormEvent) {
    event.preventDefault();
    run(
      () =>
        api("/setup", {
          method: "POST",
          body: { name, email, setup_key: key },
        }),
      () => {
        setKey("");
        navigate("/", { replace: true });
      }
    );
  }

  return (
    <div className={className}>
      <div className="mx-auto max-w-xl px-6 py-10 sm:py-14">
        <div className="mb-12 flex items-center justify-between gap-4">
          <Brand />
          <ColorSchemeControl compact />
        </div>
        <PageHeader
          eyebrow="Just once, before the crew arrives"
          title="Open the Green Room."
          description="Initialize the database and create the first member. No command line or email delivery needed."
        />
        <Card padded>
          <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-green-soft text-green">
            <KeyRound size={23} strokeWidth={1.5} />
          </div>
          <form onSubmit={submit} className="space-y-5">
            <Notice>
              Set the GitHub secret <code>APP_SETUP_KEY</code> to a unique
              random secret of at least 32 characters, then deploy. Enter that
              same key below. For manual deployments, configure{" "}
              <code>setup_key</code> in
              <code> api/config.local.php</code> instead. Never add the key to
              Git.
            </Notice>
            <Field
              label="Setup key"
              hint="The secret you configured on the server, not a sign-in link."
            >
              <Input
                type="password"
                autoComplete="off"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                minLength={32}
                required
              />
            </Field>
            <Field label="Your name">
              <Input
                autoComplete="name"
                placeholder="Nico"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </Field>
            <Field label="Email address">
              <Input
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>
            {error && <Notice tone="error">{error}</Notice>}
            <Button
              type="submit"
              variant="primary"
              loading={busy}
              className="w-full"
            >
              Create my account <ArrowRight size={16} />
            </Button>
            <p className="flex items-start gap-2 text-xs leading-relaxed text-muted">
              <ShieldCheck size={15} className="mt-0.5 shrink-0" />
              Setup locks as soon as any member exists. After finishing, delete
              APP_SETUP_KEY and redeploy (or remove your manually configured
              setup_key). Existing data is never reset.
            </p>
          </form>
        </Card>
        <ButtonLink to="/login" variant="ghost" className="mt-5">
          Already set up? Sign in
        </ButtonLink>
      </div>
    </div>
  );
}
