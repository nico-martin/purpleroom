import { ArrowLeft, LockKeyhole, Trash2 } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../api";
import SubmissionEditionLink from "../components/SubmissionEditionLink";
import SubmissionStatusSelect from "../components/SubmissionStatusSelect";
import TalkForm from "../components/TalkForm";
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
  const { data, loading, error, refresh, setData } = useApi<Paper>(
    `/papers/${id}`
  );
  const mutation = useMutation();
  if (loading && !data) return <LoadingState />;
  if (error || !data)
    return <Notice tone="error">{error ?? "Could not load this talk."}</Notice>;
  return (
    <div className={className}>
      <ButtonLink to="/talks" variant="ghost" className="-ml-4 mb-5">
        <ArrowLeft size={15} />
        My talks
      </ButtonLink>
      <PageHeader eyebrow="From your private library" title={data.title} />
      <div className="mb-6 flex items-center gap-2 text-xs text-muted">
        <LockKeyhole size={14} />
        Only you can see this page, your talk details, abstracts and notes.
      </div>
      <div className="grid gap-8 xl:grid-cols-3">
        <TalkForm
          key={data.id}
          paper={data}
          onSaved={setData}
          className="xl:col-span-2"
        />
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
    </div>
  );
}
