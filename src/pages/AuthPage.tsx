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
import AppFooter from "../components/AppFooter";
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

interface PendingCode {
  email: string;
  request_id: string;
  resendAt: number;
}
const pendingKey = "green-room-login-code";
function savedCodeRequest(): PendingCode | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(pendingKey) ?? "null"
    ) as PendingCode | null;
    return value &&
      typeof value.email === "string" &&
      /^[a-f0-9]{64}$/.test(value.request_id) &&
      typeof value.resendAt === "number"
      ? value
      : null;
  } catch {
    return null;
  }
}

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
  const [pending, setPending] = useState(savedCodeRequest);
  const [email, setEmail] = useState(pending?.email ?? "");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string>();
  const [clock, setClock] = useState(Date.now);
  const { busy, error, run, setError } = useMutation();
  const sent = pending !== null;
  const cooldown = Math.max(
    0,
    Math.ceil(((pending?.resendAt ?? 0) - clock) / 1000)
  );
  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pending]);
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
          sessionStorage.removeItem(pendingKey);
          sessionStorage.removeItem("green-room-next");
          navigate(next, { replace: true });
        }
      );
    }
    // Each verification token must be consumed once, including under StrictMode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, token]);
  function requestCode() {
    run(
      () =>
        api<{ request_id: string; code?: string }>("/auth/request", {
          method: "POST",
          body: { email },
        }),
      (result) => {
        const value = {
          email: email.trim(),
          request_id: result.request_id,
          resendAt: Date.now() + 60000,
        };
        sessionStorage.setItem(pendingKey, JSON.stringify(value));
        setPending(value);
        setClock(Date.now());
        setCode("");
        setDevCode(result.code);
      }
    );
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    requestCode();
  }
  function verifyCode(event: FormEvent) {
    event.preventDefault();
    if (!pending) return;
    run(
      () =>
        api("/auth/verify", {
          method: "POST",
          body: { request_id: pending.request_id, code },
        }),
      () => {
        sessionStorage.removeItem(pendingKey);
        sessionStorage.removeItem("green-room-next");
        navigate(next, { replace: true });
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
            <p className="mb-6 font-mono text-xs tracking-widest text-purple">
              {"{ where speakers swap notes }"}
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
            <Notice className="mt-6 max-w-md">
              <p className="font-semibold text-ink">v0 / early beta</p>
              <p className="mt-1">
                Expect bugs and rough edges. Your feedback helps shape what
                comes next.
              </p>
            </Notice>
          </section>
          <Card padded className="mx-auto w-full max-w-md">
            {mode === "login" && search.get("deleted") === "1" && (
              <Notice tone="success" className="mb-5">
                Your account and personal content have been permanently deleted.
              </Notice>
            )}
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
                ? `If ${pending.email} can receive a code, it's on its way. Paste it below in this browser. It's good for 15 minutes.`
                : "New here or coming back? We'll email you a six-digit code. No password needed."}
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
                  Request a sign-in code
                </Link>
              )
            ) : sent ? (
              <form onSubmit={verifyCode} className="space-y-5">
                {devCode && (
                  <Notice tone="success">
                    Local development code:{" "}
                    <span
                      data-testid="dev-login-code"
                      className="select-all font-mono font-semibold"
                    >
                      {devCode}
                    </span>
                  </Notice>
                )}
                <Field
                  label="Sign-in code"
                  hint="Copy all six digits from your email. Only the newest code works."
                >
                  <Input
                    autoFocus
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={code}
                    onChange={(event) =>
                      setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    onPaste={(event) => {
                      event.preventDefault();
                      setCode(
                        event.clipboardData
                          .getData("text")
                          .replace(/\D/g, "")
                          .slice(0, 6)
                      );
                    }}
                    placeholder="000000"
                    className="text-center font-mono text-2xl tracking-widest"
                  />
                </Field>
                <Button
                  type="submit"
                  variant="primary"
                  loading={busy}
                  disabled={code.length !== 6}
                  className="w-full"
                >
                  Sign in <ArrowRight size={16} />
                </Button>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy || cooldown > 0}
                    onClick={requestCode}
                  >
                    {cooldown > 0
                      ? `Resend code in ${cooldown}s`
                      : "Resend code"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => {
                      sessionStorage.removeItem(pendingKey);
                      setPending(null);
                      setCode("");
                      setDevCode(undefined);
                      setError(null);
                    }}
                  >
                    Use another email
                  </Button>
                </div>
              </form>
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
                  Send me a code
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
        <AppFooter showVersion />
      </div>
    </div>
  );
}
