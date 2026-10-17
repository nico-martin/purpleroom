import { ArrowLeft, LockKeyhole, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { api } from "../api";
import SubmissionStatusSelect from "../components/SubmissionStatusSelect";
import TalkEditor from "../components/TalkEditor";
import useApi from "../hooks/useApi";
import useMutation from "../hooks/useMutation";
import {
  Button,
  ButtonLink,
  Card,
  EmptyState,
  ListRow,
  LoadingState,
  Notice,
  PageHeader,
  SectionHeader,
} from "../theme";
import type { Paper } from "../types";

interface TalkDetailPageProps {
  className?: string;
}
export default function TalkDetailPage({
  className = "",
}: TalkDetailPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, loading, error, refresh } = useApi<Paper>(`/papers/${id}`);
  const [editing, setEditing] = useState(false);
  const mutation = useMutation();
  if (loading && !data) return <LoadingState />;
  if (error || !data) return <Notice tone="error">{error}</Notice>;
  return (
    <div className={className}>
      <ButtonLink to="/talks" variant="ghost" className="-ml-4 mb-5">
        <ArrowLeft size={15} />
        My talks
      </ButtonLink>
      <PageHeader
        eyebrow="From your private library"
        title={data.title}
        action={
          <Button variant="primary" onClick={() => setEditing(true)}>
            <Pencil size={15} />
            Edit talk
          </Button>
        }
      />
      <div className="mb-6 flex items-center gap-2 text-xs text-muted">
        <LockKeyhole size={14} />
        Only you can see this page, your abstract, and your notes.
      </div>
      <div className="grid gap-8 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card padded>
            <h2 className="mb-4 text-xl">Abstract</h2>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-ink-soft">
              {data.abstract ||
                "A blank page, full of possibilities. Edit this talk to give your idea a little more shape."}
            </p>
          </Card>
          <Card padded>
            <h2 className="mb-4 text-xl">Notes to self</h2>
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-muted">
              {data.notes || "No notes yet."}
            </p>
          </Card>
        </div>
        <section>
          <SectionHeader
            title="Out in the world"
            count={data.submissions.length}
          />
          <Card>
            {data.submissions.length ? (
              data.submissions.map((s) => (
                <ListRow key={s.id} className="flex-col items-stretch">
                  <Link
                    to={`/editions/${s.edition_id}`}
                    className="font-heading text-base font-semibold hover:text-green"
                  >
                    {s.conference?.name} {s.edition?.year}
                  </Link>
                  <SubmissionStatusSelect submission={s} onSaved={refresh} />
                </ListRow>
              ))
            ) : (
              <EmptyState
                title="Find your next stage."
                description="Add this talk to an edition from the dashboard or a conference page."
                action={<ButtonLink to="/">Browse open CFPs</ButtonLink>}
              />
            )}
          </Card>
          {mutation.error && (
            <Notice tone="error" className="mt-5">
              {mutation.error}
            </Notice>
          )}
          <Button
            variant="ghost"
            className="mt-5 text-xs"
            loading={mutation.busy}
            onClick={() => {
              if (
                confirm(
                  `Permanently delete “${data.title}” and all its submissions? This cannot be undone.`
                )
              )
                mutation.run(
                  () => api(`/papers/${id}`, { method: "DELETE" }),
                  () => navigate("/talks")
                );
            }}
          >
            <Trash2 size={14} />
            Delete talk & submissions
          </Button>
        </section>
      </div>
      {editing && (
        <TalkEditor
          paper={data}
          onClose={() => setEditing(false)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
