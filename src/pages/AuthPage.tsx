import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Mail,
  Mic2,
  Users,
} from "lucide-react";
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
  Avatar,
  Badge,
  Brand,
  Button,
  Card,
  Field,
  Input,
  LoadingState,
  Notice,
} from "../theme";

interface AuthPageProps {
  mode: "login" | "verify" | "invite";
  className?: string;
}
interface InviteInfo {
  valid: boolean;
  invited_by?: { name: string };
  email?: string;
}
export default function AuthPage({ mode, className = "" }: AuthPageProps) {
  const { token } = useParams();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [sent, setSent] = useState(false);
  const [devLink, setDevLink] = useState<string>();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const { busy, error, run, setError } = useMutation();
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
    if (mode === "invite") {
      api<InviteInfo>(`/invites/${token}`)
        .then((result) => {
          setInvite(result);
          setEmail(result.email ?? "");
        })
        .catch((e: Error) => setError(e.message));
    }
    // Tokens are consumed only once, even under StrictMode.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, token]);
  function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === "invite")
      run(
        () =>
          api(`/invites/${token}/accept`, {
            method: "POST",
            body: { email, name },
          }),
        () => navigate("/", { replace: true })
      );
    else
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
        <Brand />
        <main className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-2 lg:gap-24">
          <section>
            <Badge tone="positive" className="mb-6">
              <span className="size-1.5 rounded-full bg-green" />
              Speakers, among friends.
            </Badge>
            <h1 className="max-w-lg text-5xl leading-tight tracking-tight sm:text-6xl">
              Good stages.
              <br />
              Great company.
            </h1>
            <p className="mt-6 max-w-md text-base leading-relaxed text-muted">
              A quiet room to swap conference notes, find your next stage, and
              see where the crew is heading.
            </p>
            <div className="mt-10 space-y-5">
              {[
                {
                  icon: CalendarDays,
                  title: "The deadlines worth knowing.",
                  text: "Hand-picked CFPs, not another endless directory.",
                },
                {
                  icon: Mic2,
                  title: "The speaker's side of the story.",
                  text: "Honest takes from people you trust.",
                },
                {
                  icon: Users,
                  title: "A familiar face in the front row.",
                  text: "Know who's submitting, speaking, and going.",
                },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="flex gap-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border text-green">
                    <Icon size={19} strokeWidth={1.5} />
                  </span>
                  <div>
                    <h2 className="text-base">{title}</h2>
                    <p className="mt-0.5 text-sm text-muted">{text}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10 flex items-center gap-3 border-t border-border pt-6">
              <Avatar name="The crew" size="sm" />
              <p className="text-xs text-muted">
                Small on purpose. Better that way.
              </p>
            </div>
          </section>
          <Card padded className="mx-auto w-full max-w-md sm:p-8">
            <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-green-soft text-green">
              {sent ? (
                <Check size={24} strokeWidth={1.5} />
              ) : (
                <Mail size={24} strokeWidth={1.5} />
              )}
            </div>
            <p className="mb-2 font-mono text-xs uppercase tracking-widest text-muted">
              Your backstage pass
            </p>
            <h2 className="text-2xl">
              {mode === "invite"
                ? "There's room for you."
                : mode === "verify"
                  ? "Opening the door…"
                  : sent
                    ? "Check your inbox."
                    : "Welcome to the room."}
            </h2>
            <p className="mb-7 mt-2 text-sm leading-relaxed text-muted">
              {mode === "invite"
                ? invite?.valid
                  ? `${invite.invited_by?.name} invited you to join the crew. Make yourself at home.`
                  : "An invite from a friend is all it takes."
                : sent
                  ? "If you're part of the crew, a sign-in link is on its way. It's good for 15 minutes."
                  : "No passwords to remember. We'll email you a little magic link."}
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
                <Link to="/login" className="text-sm text-green underline">
                  Request a new sign-in link
                </Link>
              )
            ) : mode === "invite" && !invite ? (
              <LoadingState />
            ) : mode === "invite" && !invite?.valid ? (
              <Notice tone="error">
                This invite has expired or has already been used. Ask a friend
                for a fresh one.
              </Notice>
            ) : sent ? (
              <div className="space-y-4">
                {devLink && (
                  <Notice tone="success">
                    Local development:{" "}
                    <a href={devLink} className="font-semibold underline">
                      Open your sign-in link{" "}
                      <ArrowRight size={14} className="inline" />
                    </a>
                  </Notice>
                )}
                <Button
                  variant="ghost"
                  className="-ml-4"
                  onClick={() => {
                    setSent(false);
                    setError(null);
                  }}
                >
                  <ArrowLeft size={15} />
                  Use another email
                </Button>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-5">
                {mode === "invite" && (
                  <Field label="What should we call you?">
                    <Input
                      autoComplete="name"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </Field>
                )}
                <Field label="Email address">
                  <Input
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </Field>
                <Button
                  type="submit"
                  variant="primary"
                  loading={busy}
                  className="w-full"
                >
                  {mode === "invite"
                    ? "Join the crew"
                    : "Send me a sign-in link"}
                  <ArrowRight size={16} />
                </Button>
                <p className="pt-2 text-center text-xs leading-relaxed text-muted">
                  {mode === "invite"
                    ? "Your talk abstracts stay private. Your good intel doesn't have to."
                    : "New here? Ask someone in the crew for an invite."}
                </p>
              </form>
            )}
          </Card>
        </main>
        <footer className="flex justify-between border-t border-border pt-5 text-xs text-muted">
          <span>Trusted speaker intel. Just for the crew.</span>
          <span>Green Room © {new Date().getFullYear()}</span>
        </footer>
      </div>
    </div>
  );
}
