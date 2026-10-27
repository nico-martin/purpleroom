import { LockKeyhole, Mic2, Plus } from "lucide-react";

import SubmissionEditionLink from "../components/SubmissionEditionLink";
import SubmissionStatusSelect from "../components/SubmissionStatusSelect";
import TalkCard from "../components/TalkCard";
import useApi from "../hooks/useApi";
import {
  ButtonLink,
  Card,
  EmptyState,
  LoadingState,
  Notice,
  PageHeader,
  SectionHeader,
} from "../theme";
import type { Paper, Submission } from "../types";

interface TalksPageProps {
  className?: string;
}
export default function TalksPage({ className = "" }: TalksPageProps) {
  const { data, loading, error, refresh } = useApi<Paper[]>("/papers");
  const opportunities = useApi<Submission[]>("/submissions?unassigned=1");
  function refreshAll() {
    refresh();
    opportunities.refresh();
  }
  return (
    <div className={className}>
      <PageHeader
        eyebrow="Your personal purpleroom"
        title="Ideas looking for a stage."
        description="Your talk library, from first idea to front row. Your notes are just for you."
        action={
          <ButtonLink to="/talks/new" variant="primary">
            <Plus size={16} />
            New talk
          </ButtonLink>
        }
      />
      <div className="mb-7 flex items-center gap-2 text-xs text-muted">
        <LockKeyhole size={14} />
        Private library. Your talk titles, notes, and submission statuses are
        only visible to you.
      </div>
      {opportunities.error && (
        <Notice tone="error" className="mb-6">
          {opportunities.error}
        </Notice>
      )}
      {!!opportunities.data?.length && (
        <section aria-label="Speaking opportunities" className="mb-10">
          <SectionHeader
            title="Topics to be agreed"
            count={opportunities.data.length}
            description="Speaking opportunities without a specific talk. Attach one whenever you're ready."
          />
          <ul
            aria-label="Topics to be agreed"
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {opportunities.data.map((submission) => (
              <li key={submission.id} className="min-w-0">
                <Card padded className="h-full">
                  <SubmissionEditionLink
                    submission={submission}
                    className="mb-4 block break-words font-heading text-lg font-semibold hover:text-purple"
                  />
                  <SubmissionStatusSelect
                    submission={submission}
                    onSaved={refreshAll}
                  />
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section
        aria-label="Talk library"
        className={
          opportunities.data?.length ? "border-t border-border pt-8" : ""
        }
      >
        <SectionHeader
          title="Talk library"
          count={data?.length}
          description="Your reusable talks and their current submission stats."
        />
        {loading && !data ? (
          <LoadingState />
        ) : error ? (
          <Notice tone="error">{error}</Notice>
        ) : data?.length ? (
          <ul
            aria-label="My talks"
            className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
          >
            {data.map((paper) => (
              <li key={paper.id} className="min-w-0">
                <TalkCard paper={paper} onSaved={refreshAll} />
              </li>
            ))}
          </ul>
        ) : (
          <Card>
            <EmptyState
              title="It starts with an idea."
              description="Keep your talk ideas and private notes in one place. When a good CFP comes along, you'll be ready."
              action={
                <ButtonLink to="/talks/new" variant="dashed">
                  <Plus size={15} />
                  Write your first talk
                </ButtonLink>
              }
              icon={<Mic2 size={22} strokeWidth={1.5} />}
            />
          </Card>
        )}
      </section>
    </div>
  );
}
