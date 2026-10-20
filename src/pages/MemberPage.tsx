import { ExternalLink } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import CrewActions from "../components/CrewActions";
import useApi from "../hooks/useApi";
import { dateWithTimezone } from "../lib/format";
import { PROFILE_LINKS } from "../lib/profile";
import type { ProfileLinks } from "../lib/profile";
import {
  Avatar,
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  LoadingState,
  Notice,
  PageHeader,
  SectionHeader,
} from "../theme";
import type { Relationship, User } from "../types";

interface MemberProfile {
  user: User & ProfileLinks;
  relationship: Relationship;
  plans: {
    id: number;
    title: string;
    starts_on: string | null;
    starts_timezone: string | null;
    status: "going" | "maybe";
  }[];
}
export default function MemberPage() {
  const { id } = useParams();
  const { data, error, loading, refresh } = useApi<MemberProfile>(
    `/users/${id}`
  );
  if (loading && !data) return <LoadingState />;
  if (error || !data) return <Notice tone="error">{error}</Notice>;
  return (
    <div>
      <ButtonLink to="/crew" variant="ghost">
        Back to crew
      </ButtonLink>
      <PageHeader
        title={data.user.name}
        description={
          data.relationship === "friend"
            ? "Part of your crew."
            : "Member profile"
        }
      />
      <div className="mb-8 flex flex-wrap items-center gap-5">
        <Avatar name={data.user.name} src={data.user.avatar_url} size="lg" />
        <CrewActions
          id={data.user.id}
          name={data.user.name}
          relationship={data.relationship}
          onChanged={refresh}
        />
      </div>
      {PROFILE_LINKS.some(({ field }) => data.user[field]) && (
        <section className="mb-8">
          <SectionHeader title="Find me online" />
          <Card padded>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {PROFILE_LINKS.map(
                ({ field, label }) =>
                  data.user[field] && (
                    <a
                      key={field}
                      href={data.user[field]!}
                      target="_blank"
                      rel="noreferrer me"
                      className="inline-flex min-h-11 items-center gap-2 text-sm text-purple hover:underline"
                    >
                      {label}
                      <ExternalLink size={14} />
                    </a>
                  )
              )}
            </div>
          </Card>
        </section>
      )}
      {["self", "friend"].includes(data.relationship) ? (
        <section>
          <SectionHeader title="Conference plans" />
          <Card>
            {data.plans.length ? (
              data.plans.map((p) => (
                <Link
                  key={p.id}
                  to={`/editions/${p.id}`}
                  className="flex items-center justify-between gap-4 border-b border-divider p-5 last:border-0"
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">{p.title}</span>
                    <span className="break-words text-xs text-muted">
                      {dateWithTimezone(p.starts_on, p.starts_timezone)}
                    </span>
                  </span>
                  <Badge tone={p.status === "going" ? "positive" : "neutral"}>
                    {p.status === "going" ? "Going" : "Maybe"}
                  </Badge>
                </Link>
              ))
            ) : (
              <EmptyState
                title="No plans shared yet."
                description="Going and Maybe plans will appear here."
              />
            )}
          </Card>
        </section>
      ) : (
        <Notice>
          Conference plans and speaker reviews are shared only with accepted
          friends.
        </Notice>
      )}
    </div>
  );
}
