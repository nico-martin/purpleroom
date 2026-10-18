import { ArrowRight, Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";

import { api } from "../api";
import useMutation from "../hooks/useMutation";
import {
  Brand,
  Button,
  Card,
  ColorSchemeControl,
  Field,
  Input,
  LoadingState,
  Notice,
} from "../theme";

export default function AuthPage({
  mode,
  className = "",
}: {
  mode: "login" | "verify";
  className?: string;
}) {
  const { token } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string>();
  const { busy, error, run } = useMutation();
  const verified = useRef<string>();
  const intended =
    search.get("next") ?? sessionStorage.getItem("green-room-next");
  const next =
    intended?.startsWith("/") &&
    !intended.startsWith("//") &&
    !intended.includes("\\")
      ? intended
      : "/";
  useEffect(() => {
    if (mode === "login" && search.get("next"))
      sessionStorage.setItem("green-room-next", next);
    if (mode === "verify" && token && verified.current !== token) {
      verified.current = token;
      run(
        () => api("/auth/verify", { method: "POST", body: { token } }),
        () => {
          sessionStorage.removeItem("green-room-next");
          navigate(next, { replace: true });
        }
      );
    }
    // Each verification token must be consumed once, including under StrictMode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, token]);
  function submit(event: FormEvent) {
    event.preventDefault();
    run(
      () =>
        api<{ link?: string }>("/auth/request", {
          method: "POST",
          body: { email },
        }),
      (result) => {
        setSent(true);
        setDevLink(result.link);
      }
    );
  }
  return (
    <div className={className}>
      <div className="mx-auto flex min-h-screen max-w-screen-xl flex-col px-6 py-8 sm:px-12">
        <header className="flex items-center justify-between gap-4">
          <Brand />
          <ColorSchemeControl compact />
        </header>
        <main className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-2 lg:gap-24">
          <section>
            <p className="mb-6 font-mono text-xs uppercase tracking-widest text-purple">
              Speakers, among friends.
            </p>
            <h1 className="text-5xl leading-tight tracking-tight sm:text-6xl">
              Good stages.
              <br />
              Great company.
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted">
              Find your next stage, keep your proposals private, and see where
              your friends are heading.
            </p>
            <p className="mt-6 text-sm text-muted">
              Anyone can join. Everything inside is for signed-in members only.
            </p>
          </section>
          <Card padded className="mx-auto w-full max-w-md">
            <Mail className="mb-5 text-purple" />
            <h2 className="text-2xl">
              {mode === "verify"
                ? "Opening the door…"
                : sent
                  ? "Check your inbox."
                  : "Welcome to the room."}
            </h2>
            <p className="mb-6 mt-2 text-sm text-muted">
              {sent
                ? "A sign-in link is on its way if this address can receive one. It's good for 15 minutes."
                : "New here or coming back? We'll email you a sign-in link. No password needed."}
            </p>
            {error && (
              <Notice tone="error" className="mb-5">
                {error}
              </Notice>
            )}
            {mode === "verify" ? (
              busy ? (
                <LoadingState />
              ) : (
                <Link to="/login" className="text-purple underline">
                  Request a new sign-in link
                </Link>
              )
            ) : sent ? (
              <div className="space-y-4">
                {devLink && (
                  <Notice tone="success">
                    Local development:{" "}
                    <a href={devLink} className="font-semibold underline">
                      Open your sign-in link
                    </a>
                  </Notice>
                )}
                <Button onClick={() => setSent(false)}>
                  Use another email
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                <Field label="Email address">
                  <Input
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </Field>
                <Button
                  type="submit"
                  variant="primary"
                  loading={busy}
                  className="w-full"
                >
                  Send me a sign-in link
                  <ArrowRight size={16} />
                </Button>
                <p className="text-xs text-muted">
                  Your first verified sign-in creates a member account. Your
                  email is never shown to other members.
                </p>
              </form>
            )}
          </Card>
        </main>
        <footer className="border-t border-border pt-5 text-xs text-muted">
          purpleroom © {new Date().getFullYear()}
        </footer>
      </div>
    </div>
  );
}
