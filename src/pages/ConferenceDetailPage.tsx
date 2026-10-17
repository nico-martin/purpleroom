import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  Pencil,
  Plus,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "../api";
import Comments from "../components/Comments";
import ReviewEditor from "../components/ReviewEditor";
import ReviewSummary from "../components/ReviewSummary";
import useApi from "../hooks/useApi";
import useMutation from "../hooks/useMutation";
import useSession from "../hooks/useSession";
import { REVIEW_TAGS } from "../lib/constants";
import { dateRange, editionLabel, location, relativeTime } from "../lib/format";
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ListRow,
  LoadingState,
  LogoTile,
  Notice,
  SectionHeader,
  Tag,
} from "../theme";
import type { ConferenceDetail } from "../types";

interface ConferenceDetailPageProps {
  className?: string;
}
export default function ConferenceDetailPage({
  className = "",
}: ConferenceDetailPageProps) {
  const { id } = useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const { data, error, loading, refresh } = useApi<ConferenceDetail>(
    `/conferences/${id}`
  );
  const [editing, setEditing] = useState(false);
  const mutation = useMutation();
  if (loading && !data) return <LoadingState />;
  if (error || !data) return <Notice tone="error">{error}</Notice>;
  const ownReview = data.reviews.find((review) => review.user_id === user.id);
  return (
    <div className={className}>
      <ButtonLink to="/conferences" variant="ghost" className="-ml-4 mb-6">
        <ArrowLeft size={15} />
        The shortlist
      </ButtonLink>
      <header className="mb-9 flex flex-wrap items-start gap-5">
        <LogoTile name={data.name} src={data.logo_url} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="mb-1 font-mono text-xs uppercase tracking-widest text-muted">
            On the crew's radar
          </p>
          <h1 className="text-4xl tracking-tight">{data.name}</h1>
          {data.website && (
            <a
              href={data.website}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm text-green"
            >
              Conference website <ExternalLink size={14} />
            </a>
          )}
        </div>
        <ButtonLink to={`/conferences/${id}/edit`}>
          <Pencil size={15} />
          Edit
        </ButtonLink>
      </header>
      {data.description && (
        <p className="mb-9 max-w-3xl text-base leading-relaxed text-muted">
          {data.description}
        </p>
      )}
      {mutation.error && (
        <Notice tone="error" className="mb-5">
          {mutation.error}
        </Notice>
      )}
      <div className="grid gap-10 xl:grid-cols-3">
        <div className="space-y-10 xl:col-span-2">
          <section>
            <SectionHeader
              title="The speaker's side"
              count={data.review_count}
              action={
                <Button onClick={() => setEditing(true)} variant="primary">
                  <Pencil size={15} />
                  {ownReview ? "Edit my take" : "Write a speaker take"}
                </Button>
              }
            />
            <Card padded>
              <ReviewSummary conference={data} />
            </Card>
            {data.reviews.length > 0 && (
              <Card className="mt-4">
                {data.reviews.map((review) => (
                  <div
                    key={review.id}
                    className="border-b border-divider p-5 last:border-b-0 sm:p-6"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar
                        name={review.user.name}
                        src={review.user.avatar_url}
                      />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">
                          {review.user.name}
                        </p>
                        <p className="font-mono text-xs text-muted">
                          {relativeTime(review.updated_at)}
                        </p>
                      </div>
                      {review.would_submit_again !== null && (
                        <Badge
                          tone={
                            review.would_submit_again ? "positive" : "declined"
                          }
                        >
                          {review.would_submit_again ? (
                            <ThumbsUp size={12} />
                          ) : (
                            <ThumbsDown size={12} />
                          )}
                          {review.would_submit_again
                            ? "Would return"
                            : "Wouldn't return"}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {review.tags.map((tag) => (
                        <Tag key={tag}>{REVIEW_TAGS[tag]}</Tag>
                      ))}
                    </div>
                    {review.text && (
                      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-soft">
                        {review.text}
                      </p>
                    )}
                  </div>
                ))}
              </Card>
            )}
          </section>
          <Comments
            comments={data.comments}
            target={{ conference_id: data.id }}
            onSaved={refresh}
          />
        </div>
        <aside>
          <SectionHeader
            title="Editions"
            count={data.editions.length}
            action={
              <ButtonLink
                to={`/editions/new?conference=${id}`}
                variant="dashed"
              >
                <Plus size={15} />
                New edition
              </ButtonLink>
            }
          />
          <Card>
            {data.editions.length ? (
              data.editions.map((edition) => (
                <ListRow key={edition.id}>
                  <Link to={`/editions/${edition.id}`} className="flex-1">
                    <h3 className="text-lg">
                      {editionLabel(edition, data.name)}
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      {location(edition)}
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted">
                      {dateRange(edition)}
                    </p>
                  </Link>
                  <Link
                    to={`/editions/${edition.id}`}
                    aria-label={`View ${editionLabel(edition, data.name)}`}
                    className="flex size-11 items-center justify-center text-green"
                  >
                    <ArrowRight size={16} />
                  </Link>
                </ListRow>
              ))
            ) : (
              <EmptyState
                title="Give it a date."
                description="Add an edition with dates, location, and the CFP details."
              />
            )}
          </Card>
          <p className="mt-5 text-xs leading-relaxed text-muted">
            The conference is the story. An edition is a chapter: a year, a
            city, a new chance to speak.
          </p>
          <Button
            variant="ghost"
            className="mt-6 text-xs"
            loading={mutation.busy}
            onClick={() => {
              if (
                confirm(
                  `Move ${data.name} and its editions to recently deleted? The crew can restore it.`
                )
              )
                mutation.run(
                  () => api(`/conferences/${id}`, { method: "DELETE" }),
                  () => navigate("/conferences")
                );
            }}
          >
            <Trash2 size={14} />
            Move to recently deleted
          </Button>
        </aside>
      </div>
      {editing && (
        <ReviewEditor
          conferenceId={data.id}
          review={ownReview}
          onClose={() => setEditing(false)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
