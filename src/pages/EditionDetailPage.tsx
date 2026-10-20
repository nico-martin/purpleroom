import {
  ArrowLeft,
  CalendarDays,
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "../api";
import ReviewSummary from "../components/ReviewSummary";
import SubmissionModal from "../components/SubmissionModal";
import SubmissionStatusSelect from "../components/SubmissionStatusSelect";
import useApi from "../hooks/useApi";
import useMutation from "../hooks/useMutation";
import useSession from "../hooks/useSession";
import {
  cfpClosingTime,
  cfpDaysUntil,
  dateRange,
  dateWithTimezone,
  editionLabel,
  formatDate,
  location,
} from "../lib/format";
import {
  Avatar,
  Button,
  ButtonLink,
  Card,
  DeadlineBadge,
  LoadingState,
  LogoTile,
  Notice,
  SectionHeader,
  SegmentedControl,
} from "../theme";
import type { EditionDetail } from "../types";

export default function EditionDetailPage({
  className = "",
}: {
  className?: string;
}) {
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
  const name = editionLabel(data, data.conference.name);
  const friends = data.submitted_friends ?? [];
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
            Conference edition
          </p>
          <h1 className="text-3xl tracking-tight sm:text-4xl">{name}</h1>
          <div className="mt-3 flex flex-wrap gap-5 text-sm text-muted">
            <span className="flex items-center gap-2">
              <MapPin size={15} />
              {location(data)}
            </span>
            <span className="flex min-w-0 items-start gap-2">
              <CalendarDays size={15} className="shrink-0" />
              <span className="min-w-0 break-words">{dateRange(data)}</span>
            </span>
          </div>
        </div>
        {user.role === "admin" && (
          <ButtonLink to={`/editions/${id}/edit`}>
            <Pencil size={15} />
            Edit details
          </ButtonLink>
        )}
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
                    ? `Opens ${dateWithTimezone(data.cfp_opens_on, data.cfp_opens_timezone)}. `
                    : ""}
                  {data.cfp_closes_on
                    ? `Closes ${formatDate(data.cfp_closes_on)}, ${cfpClosingTime(data)}`
                    : "No deadline yet. Keep an eye out."}
                </p>
              </div>
              {data.cfp_closes_on && (
                <DeadlineBadge days={cfpDaysUntil(data)} />
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
                  className="inline-flex min-h-11 items-center gap-2 text-sm text-purple"
                >
                  Visit the CFP
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
            <p className="mt-4 text-xs text-muted">
              Your proposals and statuses are private. Friends can only see that
              you've submitted, not how many talks or the outcome. Adding a talk
              here does not submit it to the conference.
            </p>
            {data.my_submissions.length > 0 && (
              <div className="mt-6 space-y-4 border-t border-divider pt-5">
                <h3 className="text-sm">My submissions</h3>
                {data.my_submissions.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-3"
                  >
                    <span className="min-w-0 flex-1 break-words text-sm">
                      {s.paper_title ?? "Topic to be agreed"}
                    </span>
                    <SubmissionStatusSelect submission={s} onSaved={refresh} />
                  </div>
                ))}
              </div>
            )}
          </Card>
          <section>
            <SectionHeader
              title="Friends who submitted"
              count={friends.length}
            />
            <Card padded>
              <p className="text-sm text-muted">
                {friends.length}{" "}
                {friends.length === 1 ? "friend has" : "friends have"} submitted
                a CFP.
              </p>
              {friends.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-4">
                  {friends.map((person) => (
                    <Link
                      to={`/members/${person.id}`}
                      key={person.id}
                      className="flex items-center gap-2"
                    >
                      <Avatar
                        name={person.name}
                        src={person.avatar_url}
                        size="sm"
                      />
                      <span className="text-sm">{person.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Card>
          </section>
          <section>
            <SectionHeader
              title="See you there?"
              description="Your plans are independent of your submissions. Only your crew can see them."
            />
            <Card padded>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <span className="text-sm">My attendance</span>
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
              {[
                { label: "Going", people: data.going },
                { label: "Maybe", people: data.maybe },
              ]
                .filter((g) => g.people.length)
                .map((group) => (
                  <div
                    key={group.label}
                    className="mt-5 border-t border-divider pt-4"
                  >
                    <p className="mb-3 text-xs font-semibold text-muted">
                      {group.label}
                    </p>
                    <div className="flex flex-wrap gap-4">
                      {group.people.map((person) => (
                        <Link
                          key={person.id}
                          to={`/members/${person.id}`}
                          className="flex items-center gap-2"
                        >
                          <Avatar
                            name={person.name}
                            src={person.avatar_url}
                            size="sm"
                          />
                          <span className="text-sm">
                            {person.id === user.id ? "You" : person.name}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
            </Card>
          </section>
        </div>
        <aside className="space-y-6">
          <section>
            <SectionHeader title="Before you submit" />
            <Card padded>
              <h3 className="mb-4 text-base">Your crew's speaker intel</h3>
              <ReviewSummary conference={data.conference} />
              <ButtonLink
                to={`/conferences/${data.conference_id}`}
                variant="ghost"
                className="-ml-4 mt-4 text-purple"
              >
                Read the speaker takes
                <ExternalLink size={13} />
              </ButtonLink>
            </Card>
          </section>
          {data.notes && (
            <Card padded>
              <h3>Worth knowing</h3>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm text-muted">
                {data.notes}
              </p>
            </Card>
          )}
          {(data.website || data.conference.website) && (
            <a
              href={data.website || data.conference.website || ""}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center gap-2 text-sm text-purple"
            >
              Conference website
              <ExternalLink size={14} />
            </a>
          )}
          {user.role === "admin" && (
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
          )}
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
