import { ArrowRight, CalendarDays, Mic2, Plus } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import CfpRow from "../components/CfpRow";
import SubmissionModal from "../components/SubmissionModal";
import useApi from "../hooks/useApi";
import useSession from "../hooks/useSession";
import { dateRange, formatDate, location, relativeTime } from "../lib/format";
import {
  Avatar,
  AvatarStack,
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  ListRow,
  LoadingState,
  LogoTile,
  Notice,
  PageHeader,
  SectionHeader,
} from "../theme";
import type { Cfp, Dashboard } from "../types";

interface DashboardPageProps {
  className?: string;
}
export default function DashboardPage({ className = "" }: DashboardPageProps) {
  const { user } = useSession();
  const { data, error, loading, refresh } = useApi<Dashboard>("/dashboard");
  const [selected, setSelected] = useState<Cfp | null>(null);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";
  if (loading && !data) return <LoadingState />;
  if (error || !data) return <Notice tone="error">{error}</Notice>;
  const urgent = data.open_cfps.filter((c) => c.days_left <= 7).length;
  return (
    <div className={className}>
      <PageHeader
        eyebrow={formatDate(new Date().toISOString(), {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
        title={`${greeting}, ${user.name.split(" ")[0]}.`}
        description="Your next stage might be in here. Let's take a look."
        action={
          <ButtonLink to="/conferences/new" variant="primary">
            <Plus size={17} />
            Add a conference
          </ButtonLink>
        }
      />
      <div className="mb-9 flex flex-wrap items-center gap-x-7 gap-y-3 border-y border-border py-4 text-sm">
        <span className="flex items-center gap-2 text-muted">
          <span className="font-mono text-base text-ink">
            {data.open_cfps.length.toString().padStart(2, "0")}
          </span>{" "}
          open CFPs
        </span>
        <span className="flex items-center gap-2 text-muted">
          <span className="font-mono text-base text-ink">
            {data.upcoming.length.toString().padStart(2, "0")}
          </span>{" "}
          upcoming conferences
        </span>
        <span className="ml-auto flex items-center gap-2 text-xs text-muted">
          <span className="size-1.5 rounded-full bg-green" />A little intel goes
          a long way
        </span>
      </div>
      <div className="grid gap-10 xl:grid-cols-3">
        <div className="space-y-10 xl:col-span-2">
          <section>
            <SectionHeader
              title="Open calls, open possibilities"
              count={data.open_cfps.length}
              description="Hand-picked by the crew. Ordered by deadline."
              action={
                urgent ? (
                  <Badge tone="urgent">{urgent} closing this week</Badge>
                ) : undefined
              }
            />
            <Card>
              {data.open_cfps.length ? (
                data.open_cfps.map((cfp) => (
                  <CfpRow
                    key={cfp.edition.id}
                    cfp={cfp}
                    onSubmit={() => setSelected(cfp)}
                  />
                ))
              ) : (
                <EmptyState
                  title="Your next stage is out there."
                  description="Found a conference worth sharing? Add it and its CFP so the crew can get in on it."
                  action={
                    <ButtonLink to="/conferences/new" variant="dashed">
                      <Plus size={15} />
                      Add the first conference
                    </ButtonLink>
                  }
                />
              )}
            </Card>
            <p className="mt-3 flex items-center gap-2 text-xs text-muted">
              <CalendarDays size={13} />
              Don't miss a deadline.{" "}
              <Link
                to="/settings"
                className="text-green underline underline-offset-4"
              >
                Subscribe to your calendar
              </Link>
            </p>
          </section>
          <section>
            <SectionHeader
              title="Who's going where"
              count={data.upcoming.length}
              description="Good talks are even better with a familiar face."
              action={
                <Link
                  to="/conferences"
                  className="flex min-h-11 items-center gap-1 text-xs font-semibold text-green"
                >
                  All conferences <ArrowRight size={14} />
                </Link>
              }
            />
            <Card>
              {data.upcoming.length ? (
                data.upcoming.map(
                  ({ edition, conference, speaking, going, maybe }) => (
                    <ListRow key={edition.id}>
                      <div className="flex w-14 shrink-0 flex-col items-center border-r border-divider pr-4">
                        <span className="font-mono text-xs uppercase text-muted">
                          {formatDate(edition.starts_on, { month: "short" })}
                        </span>
                        <span className="mt-0.5 font-heading text-2xl">
                          {formatDate(edition.starts_on, { day: "2-digit" })}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/editions/${edition.id}`}
                          className="font-heading text-base font-semibold hover:text-green"
                        >
                          {conference.name} {edition.year}
                        </Link>
                        <p className="mt-1 text-xs text-muted">
                          {location(edition)} · {dateRange(edition)}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {speaking.length > 0 && (
                            <Badge tone="positive">
                              <Mic2 size={11} />
                              {speaking.length} speaking
                            </Badge>
                          )}
                          {going.length > 0 && (
                            <span className="text-xs text-muted">
                              {going.length} going
                            </span>
                          )}
                          {maybe.length > 0 && (
                            <span className="text-xs text-muted">
                              {maybe.length} maybe
                            </span>
                          )}
                          {!speaking.length &&
                            !going.length &&
                            !maybe.length && (
                              <span className="text-xs text-muted">
                                Anyone heading this way?
                              </span>
                            )}
                        </div>
                      </div>
                      <AvatarStack
                        users={[
                          ...new Map(
                            [...speaking.map((s) => s.user), ...going].map(
                              (u) => [u.id, u]
                            )
                          ).values(),
                        ]}
                      />
                      <Link
                        aria-label={`View ${conference.name}`}
                        to={`/editions/${edition.id}`}
                        className="flex size-11 items-center justify-center text-muted hover:text-green"
                      >
                        <ArrowRight size={17} />
                      </Link>
                    </ListRow>
                  )
                )
              ) : (
                <EmptyState
                  title="Nothing on the horizon. Yet."
                  description="Add an edition to a conference and it will find its way here."
                  icon={<CalendarDays size={22} strokeWidth={1.5} />}
                />
              )}
            </Card>
          </section>
          <div className="flex items-center gap-4 rounded-2xl bg-green-soft p-5">
            <LogoTile name="Green Room" className="bg-transparent" />
            <div>
              <h3 className="text-base text-green-deep">
                Not a directory. A little collective wisdom.
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-green-deep/80">
                Been to a conference? Leave a speaker take. It's the stuff you
                wish you'd known before submitting.
              </p>
            </div>
          </div>
        </div>
        <aside>
          <SectionHeader
            title="Around the room"
            description="The latest from your people."
          />
          <Card padded>
            {data.recent_activity.length ? (
              <div className="space-y-6">
                {data.recent_activity.slice(0, 10).map((activity, index) => (
                  <Link
                    key={`${activity.type}-${index}`}
                    to={activity.link}
                    className="group flex gap-3"
                  >
                    <Avatar
                      name={activity.user.name}
                      src={activity.user.avatar_url}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <p className="text-sm leading-relaxed text-ink-soft">
                        <span className="font-semibold text-ink">
                          {activity.user.name.split(" ")[0]}
                        </span>{" "}
                        {activity.summary}
                        <span className="text-green group-hover:underline">
                          .
                        </span>
                      </p>
                      <p className="mt-1.5 font-mono text-xs text-muted">
                        {relativeTime(activity.at)}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                title="A quiet room, for now."
                description="New conferences, speaker takes, and the crew's plans will show up here."
                className="px-0 py-5"
              />
            )}
          </Card>
          <div className="mt-6 px-1">
            <p className="font-heading text-base">Know a good human?</p>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              There's always room for another friend with a story to tell.
            </p>
            <ButtonLink
              to="/crew"
              variant="ghost"
              className="-ml-4 mt-2 text-green"
            >
              Invite them in <ArrowRight size={15} />
            </ButtonLink>
          </div>
        </aside>
      </div>
      {selected && (
        <SubmissionModal
          editionId={selected.edition.id}
          editionName={`${selected.conference.name} ${selected.edition.year}`}
          onClose={() => setSelected(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
