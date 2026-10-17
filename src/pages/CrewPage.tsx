import { Clock3, Link2, Plus, Users } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { api } from "../api";
import useApi from "../hooks/useApi";
import useMutation from "../hooks/useMutation";
import useSession from "../hooks/useSession";
import { formatDate } from "../lib/format";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CopyField,
  Field,
  Input,
  ListRow,
  LoadingState,
  Modal,
  Notice,
  PageHeader,
  SectionHeader,
} from "../theme";
import type { Invite, User } from "../types";

interface CrewPageProps {
  className?: string;
}
export default function CrewPage({ className = "" }: CrewPageProps) {
  const { user } = useSession();
  const members = useApi<User[]>("/users");
  const invites = useApi<Invite[]>("/invites");
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<{ url: string; expires_at: string } | null>(
    null
  );
  const mutation = useMutation();
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.run(
      () =>
        api<{ url: string; expires_at: string }>("/invites", {
          method: "POST",
          body: { email: email || null },
        }),
      (result) => {
        setLink(result);
        invites.refresh();
      }
    );
  }
  return (
    <div className={className}>
      <PageHeader
        eyebrow="The people behind the talks"
        title="Your kind of company."
        description="A small crew of speakers. A lot of collective experience. No strangers, just friends of friends."
        action={
          <Button
            variant="primary"
            onClick={() => {
              setCreating(true);
              setLink(null);
              setEmail("");
            }}
          >
            <Plus size={16} />
            Invite a friend
          </Button>
        }
      />
      <div className="grid gap-9 xl:grid-cols-3">
        <section className="xl:col-span-2">
          <SectionHeader title="The crew" count={members.data?.length} />
          {members.loading ? (
            <LoadingState />
          ) : members.error ? (
            <Notice tone="error">{members.error}</Notice>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {members.data?.map((person) => (
                <Card padded key={person.id}>
                  <div className="flex items-center gap-4">
                    <Avatar
                      name={person.name}
                      src={person.avatar_url}
                      size="lg"
                    />
                    <div>
                      <h2 className="text-lg">{person.name}</h2>
                      <p className="mt-1 text-xs text-muted">
                        Part of the crew
                      </p>
                    </div>
                    {person.id === user.id && (
                      <Badge tone="positive" className="ml-auto">
                        You
                      </Badge>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
        <aside>
          <SectionHeader title="Room for one more" />
          <Card padded>
            <Users size={24} className="mb-4 text-green" strokeWidth={1.4} />
            <h3 className="text-lg">Good people know good people.</h3>
            <p className="mt-3 text-sm leading-relaxed text-muted">
              Invite someone you'd happily share a speaker dinner with. Everyone
              has the same backstage pass.
            </p>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Invite links work once and expire after 14 days. Share them
              however you like.
            </p>
            <Button
              variant="dashed"
              className="mt-5"
              onClick={() => {
                setCreating(true);
                setLink(null);
              }}
            >
              <Link2 size={15} />
              Make an invite link
            </Button>
          </Card>
        </aside>
      </div>
      <section className="mt-10">
        <SectionHeader title="Open invitations" count={invites.data?.length} />
        {invites.error && <Notice tone="error">{invites.error}</Notice>}
        <Card>
          {invites.data?.length ? (
            invites.data.map((invite) => (
              <ListRow key={invite.id}>
                <div className="flex size-10 items-center justify-center rounded-xl bg-divider text-muted">
                  <Link2 size={17} />
                </div>
                <div className="flex-1">
                  <p className="text-sm">
                    {invite.email || "An open seat at the table"}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Invited by {invite.invited_by.name}
                  </p>
                </div>
                <span className="flex items-center gap-2 font-mono text-xs text-muted">
                  <Clock3 size={13} />
                  Until{" "}
                  {formatDate(invite.expires_at, {
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </ListRow>
            ))
          ) : (
            <p className="p-6 text-sm text-muted">
              No open invitations. All caught up.
            </p>
          )}
        </Card>
      </section>
      {creating && (
        <Modal
          title="Pull up another chair."
          onClose={() => setCreating(false)}
        >
          {link ? (
            <div className="space-y-5">
              <Notice tone="success">
                Your invite is ready. Share it with a good human.
              </Notice>
              <CopyField value={link.url} label="invite link" />
              <p className="text-xs text-muted">
                One use only. Good until {formatDate(link.expires_at)}. Save the
                link now; we don't store it in readable form.
              </p>
              <div className="flex justify-end">
                <Button onClick={() => setCreating(false)}>Done</Button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <p className="text-sm leading-relaxed text-muted">
                No email will be sent. We'll give you a link to share yourself.
              </p>
              <Field
                label="Their email (optional)"
                hint="Just a prefill for their sign-up form, not a restriction."
              >
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="friend@example.com"
                />
              </Field>
              {mutation.error && <Notice tone="error">{mutation.error}</Notice>}
              <div className="flex justify-end gap-2">
                <Button onClick={() => setCreating(false)}>Cancel</Button>
                <Button type="submit" variant="primary" loading={mutation.busy}>
                  <Link2 size={15} />
                  Create invite link
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
