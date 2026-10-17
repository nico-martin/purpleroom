import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  MapPin,
  Mic2,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../api";
import Comments from "../components/Comments";
import ReviewSummary from "../components/ReviewSummary";
import SubmissionModal from "../components/SubmissionModal";
import SubmissionStatusSelect from "../components/SubmissionStatusSelect";
import useApi from "../hooks/useApi";
import useMutation from "../hooks/useMutation";
import useSession from "../hooks/useSession";
import { daysUntil, formatDate, location } from "../lib/format";
import {
  Avatar,
  Button,
  ButtonLink,
  Card,
  DeadlineBadge,
  EmptyState,
  ListRow,
  LoadingState,
  LogoTile,
  Notice,
  SectionHeader,
  SegmentedControl,
  StatusChip,
} from "../theme";
import type { EditionDetail } from "../types";

interface EditionDetailPageProps {
  className?: string;
}
export default function EditionDetailPage({
  className = "",
}: EditionDetailPageProps) {
  const { id } = useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const { data, loading, error, refresh } = useApi<EditionDetail>(
    `/editions/${id}`
  );
  const [submitting, setSubmitting] = useState(false);
  const mutation = useMutation();
  if (loading && !data) return <LoadingState />;
  if (error || !data) return <Notice tone="error">{error}</Notice>;
  const attendance =
    data.attendance.find((a) => a.user_id === user.id)?.status ?? "none";
  const name = `${data.conference.name} ${data.year}`;
  return (
    <div className={className}>
      <ButtonLink
        to={`/conferences/${data.conference_id}`}
        variant="ghost"
        className="-ml-4 mb-6"
      >
        <ArrowLeft size={15} />
        {data.conference.name}
      </ButtonLink>
      <header className="mb-8 flex flex-wrap items-center gap-5">
        <LogoTile
          name={data.conference.name}
          src={data.conference.logo_url}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <p className="mb-1 font-mono text-xs uppercase tracking-widest text-muted">
            The {data.year} edition
          </p>
          <h1 className="text-3xl tracking-tight sm:text-4xl">{name}</h1>
          <div className="mt-3 flex flex-wrap gap-5 text-sm text-muted">
            <span className="flex items-center gap-2">
              <MapPin size={15} />
              {location(data)}
            </span>
            <span className="flex items-center gap-2">
              <CalendarDays size={15} />
              {formatDate(data.starts_on)}
              {data.ends_on && data.ends_on !== data.starts_on
                ? ` – ${formatDate(data.ends_on)}`
                : ""}
            </span>
          </div>
        </div>
        <ButtonLink to={`/editions/${id}/edit`}>
          <Pencil size={15} />
          Edit details
        </ButtonLink>
      </header>
      {mutation.error && (
        <Notice tone="error" className="mb-5">
          {mutation.error}
        </Notice>
      )}
      <div className="grid gap-10 xl:grid-cols-3">
        <div className="space-y-9 xl:col-span-2">
          <Card padded>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl">Call for papers</h2>
                <p className="mt-2 text-sm text-muted">
                  {data.cfp_opens_on
                    ? `${formatDate(data.cfp_opens_on)} – `
                    : ""}
                  {data.cfp_closes_on
                    ? formatDate(data.cfp_closes_on)
                    : "No deadline yet. Keep an eye out."}
                </p>
              </div>
              {data.cfp_closes_on && (
                <DeadlineBadge days={daysUntil(data.cfp_closes_on)} />
              )}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-4">
              <Button variant="primary" onClick={() => setSubmitting(true)}>
                <Plus size={16} />
                Add my talk
              </Button>
              {data.cfp_url && (
                <a
                  href={data.cfp_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-green"
                >
                  Visit the CFP <ExternalLink size={14} />
                </a>
              )}
            </div>
            {data.my_submissions.length > 0 && (
              <div className="mt-6 space-y-4 border-t border-divider pt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  My submissions
                </p>
                {data.my_submissions.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3"
                  >
                    <span className="text-sm">{s.paper_title}</span>
                    <SubmissionStatusSelect submission={s} onSaved={refresh} />
                  </div>
                ))}
              </div>
            )}
          </Card>
          <section>
            <SectionHeader
              title="In the running"
              count={data.submissions.length}
              description="The crew's talks and where they stand."
            />
            <Card>
              {data.submissions.length ? (
                data.submissions.map((s) => (
                  <ListRow key={s.id}>
                    <Avatar name={s.user.name} src={s.user.avatar_url} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold">{s.user.name}</p>
                      <p className="mt-1 break-words text-sm text-muted">
                        {s.paper_title ?? "Untitled talk"}
                      </p>
                    </div>
                    <StatusChip status={s.status} />
                  </ListRow>
                ))
              ) : (
                <EmptyState
                  title="The stage is open."
                  description="Thinking about submitting? Add a talk, even if you're just interested for now."
                  icon={<Mic2 size={22} strokeWidth={1.5} />}
                />
              )}
            </Card>
          </section>
          <section>
            <SectionHeader
              title="See you there?"
              description="Not every good conference trip needs a talk."
            />
            <Card padded>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Avatar name={user.name} src={user.avatar_url} />
                  <span className="text-sm">My attendance</span>
                </div>
                <SegmentedControl
                  label="My attendance"
                  value={attendance}
                  options={[
                    { value: "none", label: "Not going" },
                    { value: "maybe", label: "Maybe" },
                    { value: "going", label: "Going" },
                  ]}
                  disabled={mutation.busy}
                  onChange={(status) =>
                    mutation.run(
                      () =>
                        api(`/editions/${id}/attendance`, {
                          method: status === "none" ? "DELETE" : "PUT",
                          body: status === "none" ? undefined : { status },
                        }),
                      refresh
                    )
                  }
                />
              </div>
              {data.going.length || data.maybe.length ? (
                <div className="mt-6 space-y-4 border-t border-divider pt-5">
                  {[
                    { label: "Going", people: data.going },
                    { label: "Maybe", people: data.maybe },
                  ]
                    .filter((group) => group.people.length)
                    .map((group) => (
                      <div key={group.label}>
                        <p className="mb-3 text-xs font-semibold text-muted">
                          {group.label}
                        </p>
                        <div className="flex flex-wrap gap-4">
                          {group.people.map((person) => (
                            <div
                              key={person.id}
                              className="flex items-center gap-2"
                            >
                              <Avatar
                                name={person.name}
                                src={person.avatar_url}
                                size="sm"
                              />
                              <span className="text-sm">{person.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p className="mt-5 flex items-center gap-2 text-xs text-muted">
                  <Users size={14} />
                  No travel plans yet. Be the first.
                </p>
              )}
            </Card>
          </section>
          <Comments
            comments={data.comments}
            target={{ edition_id: data.id }}
            onSaved={refresh}
          />
        </div>
        <aside className="space-y-6">
          <section>
            <SectionHeader title="Before you submit" />
            <Card padded>
              <h3 className="mb-4 text-base">The crew's speaker intel</h3>
              <ReviewSummary conference={data.conference} />
              <ButtonLink
                to={`/conferences/${data.conference_id}`}
                variant="ghost"
                className="-ml-4 mt-4 text-green"
              >
                Read the speaker takes <ExternalLink size={13} />
              </ButtonLink>
            </Card>
          </section>
          {data.notes && (
            <Card padded>
              <h3 className="text-base">Worth knowing</h3>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted">
                {data.notes}
              </p>
            </Card>
          )}
          {(data.website || data.conference.website) && (
            <a
              href={data.website || data.conference.website || ""}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center gap-2 text-sm text-green"
            >
              Conference website <ExternalLink size={14} />
            </a>
          )}
          <Button
            variant="ghost"
            className="text-xs"
            loading={mutation.busy}
            onClick={() => {
              if (confirm(`Move ${name} to recently deleted?`))
                mutation.run(
                  () => api(`/editions/${id}`, { method: "DELETE" }),
                  () => navigate(`/conferences/${data.conference_id}`)
                );
            }}
          >
            <Trash2 size={14} />
            Move to recently deleted
          </Button>
        </aside>
      </div>
      {submitting && (
        <SubmissionModal
          editionId={data.id}
          editionName={name}
          onClose={() => setSubmitting(false)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
