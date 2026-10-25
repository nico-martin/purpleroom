import { ArrowLeft, LockKeyhole, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../api";
import SubmissionEditionLink from "../components/SubmissionEditionLink";
import SubmissionStatusSelect from "../components/SubmissionStatusSelect";
import TalkEditor from "../components/TalkEditor";
import useApi from "../hooks/useApi";
import useMutation from "../hooks/useMutation";
import { PAPER_AUDIENCE_LEVELS, PAPER_FORMATS } from "../lib/constants";
import { textCounts } from "../lib/text";
import {
  Button,
  ButtonLink,
  Card,
  CopyButton,
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
  // [label, copied value, displayed text, hint]
  const details: [string, string, string, string?][] = [
    ["Title", data.title, data.title, textCounts(data.title)],
  ];
  if (data.duration_minutes !== null)
    details.push([
      "Duration in minutes",
      String(data.duration_minutes),
      `${data.duration_minutes} minutes`,
    ]);
  if (data.audience_level) {
    const level = PAPER_AUDIENCE_LEVELS[data.audience_level];
    details.push(["Audience level", level, level]);
  }
  if (data.language) details.push(["Language", data.language, data.language]);
  if (data.format) {
    const format = PAPER_FORMATS[data.format];
    details.push(["Format", format, format]);
  }
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
        Only you can see this page, your talk details, abstracts and notes.
      </div>
      <div className="grid gap-8 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <section aria-label="Talk details">
            <Card padded className="space-y-3">
              <h2 className="mb-4 text-xl">Talk details</h2>
              {details.map(([label, value, shown, hint]) => (
                <div key={label} className="space-y-1">
                  <p className="px-3 text-xs text-muted">{label}</p>
                  <CopyButton
                    appearance="text"
                    value={value}
                    label={label.toLowerCase()}
                  >
                    {shown}
                  </CopyButton>
                  {hint && <p className="px-3 text-xs text-muted">{hint}</p>}
                </div>
              ))}
            </Card>
          </section>
          <section aria-label="Abstract variants">
            <Card padded className="space-y-5">
              <h2 className="mb-4 text-xl">Abstract variants</h2>
              {data.abstract_variants.length ? (
                data.abstract_variants.map((variant, i) => (
                  <div key={i} className="space-y-1">
                    <h3 className="px-3 text-sm font-semibold">
                      {variant.label}
                    </h3>
                    <CopyButton
                      appearance="text"
                      value={variant.text}
                      label={`${variant.label} abstract`}
                    />
                    <p className="px-3 text-xs text-muted">
                      {textCounts(variant.text)}
                    </p>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No abstracts yet."
                  description="Save named abstract variants, then copy them straight into the next CFP form."
                  action={
                    <Button onClick={() => setEditing(true)}>
                      <Pencil size={15} />
                      Edit talk
                    </Button>
                  }
                />
              )}
            </Card>
          </section>
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
                  <SubmissionEditionLink
                    submission={s}
                    className="font-heading text-base font-semibold hover:text-green"
                  />
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
