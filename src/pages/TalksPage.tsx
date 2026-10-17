import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  LockKeyhole,
  Mic2,
  Plus,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

import SubmissionStatusSelect from "../components/SubmissionStatusSelect";
import TalkEditor from "../components/TalkEditor";
import useApi from "../hooks/useApi";
import { formatDate } from "../lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingState,
  Notice,
  PageHeader,
} from "../theme";
import type { Paper } from "../types";

interface TalksPageProps {
  className?: string;
}
export default function TalksPage({ className = "" }: TalksPageProps) {
  const { data, loading, error, refresh } = useApi<Paper[]>("/papers");
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<number[]>([]);
  return (
    <div className={className}>
      <PageHeader
        eyebrow="Your personal green room"
        title="Ideas looking for a stage."
        description="Your talk library, from first idea to front row. Your notes are just for you."
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} />
            New talk
          </Button>
        }
      />
      <div className="mb-7 flex items-center gap-2 text-xs text-muted">
        <LockKeyhole size={14} />
        Private library. Only titles and submission statuses are shared.
      </div>
      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <Notice tone="error">{error}</Notice>
      ) : data?.length ? (
        <div className="space-y-4">
          {data.map((paper) => {
            const open = expanded.includes(paper.id);
            return (
              <Card key={paper.id}>
                <div className="flex items-center gap-4 p-5 sm:p-6">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-green-soft text-green">
                    <Mic2 size={20} strokeWidth={1.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/talks/${paper.id}`}
                      className="font-heading text-lg font-semibold hover:text-green"
                    >
                      {paper.title}
                    </Link>
                    <p className="mt-1 font-mono text-xs text-muted">
                      Updated{" "}
                      {formatDate(paper.updated_at, {
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                  </div>
                  <Badge className="hidden sm:inline-flex">
                    {paper.submissions.length} submissions
                  </Badge>
                  <Button
                    variant="ghost"
                    aria-label={
                      open ? "Collapse submissions" : "Expand submissions"
                    }
                    aria-expanded={open}
                    className="size-11 p-0"
                    onClick={() =>
                      setExpanded((current) =>
                        open
                          ? current.filter((id) => id !== paper.id)
                          : [...current, paper.id]
                      )
                    }
                  >
                    {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </Button>
                </div>
                {open && (
                  <div className="border-t border-divider">
                    {paper.submissions.length ? (
                      <div className="divide-y divide-divider">
                        {paper.submissions.map((s) => (
                          <div
                            key={s.id}
                            className="flex flex-wrap items-center gap-4 p-5 sm:px-6"
                          >
                            <div className="min-w-0 flex-1">
                              <Link
                                to={`/editions/${s.edition_id}`}
                                className="text-sm font-semibold hover:text-green"
                              >
                                {s.conference?.name} {s.edition?.year}
                              </Link>
                              <p className="mt-1 text-xs text-muted">
                                CFP:{" "}
                                {s.edition?.cfp_closes_on
                                  ? formatDate(s.edition.cfp_closes_on)
                                  : "No deadline"}
                              </p>
                            </div>
                            <SubmissionStatusSelect
                              submission={s}
                              onSaved={refresh}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyState
                        title="No submissions. Plenty of possibilities."
                        description="Head to the room, find an open CFP, and add this talk."
                        action={
                          <Link
                            to="/"
                            className="flex min-h-11 items-center gap-2 text-sm text-green"
                          >
                            Find a stage <ArrowUpRight size={15} />
                          </Link>
                        }
                      />
                    )}
                    <div className="border-t border-divider px-6 py-3">
                      <Link
                        to={`/talks/${paper.id}`}
                        className="inline-flex min-h-11 items-center gap-2 text-sm text-green"
                      >
                        Edit talk <ArrowUpRight size={14} />
                      </Link>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <EmptyState
            title="It starts with an idea."
            description="Keep your talk ideas and private notes in one place. When a good CFP comes along, you'll be ready."
            action={
              <Button variant="dashed" onClick={() => setCreating(true)}>
                <Plus size={15} />
                Write your first talk
              </Button>
            }
            icon={<Mic2 size={22} strokeWidth={1.5} />}
          />
        </Card>
      )}
      {creating && (
        <TalkEditor onClose={() => setCreating(false)} onSaved={refresh} />
      )}
    </div>
  );
}
