import { LockKeyhole, Plus } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { api } from "../api";
import useApi from "../hooks/useApi";
import useMutation from "../hooks/useMutation";
import { SUBMISSION_STATUSES } from "../lib/constants";
import {
  Button,
  Checkbox,
  Field,
  Input,
  LoadingState,
  Modal,
  Notice,
  SegmentedControl,
  Select,
  Textarea,
} from "../theme";
import type { Paper, SubmissionStatus } from "../types";

interface SubmissionModalProps {
  editionId: number;
  editionName: string;
  onClose: () => void;
  onSaved: () => void;
  className?: string;
}
export default function SubmissionModal({
  editionId,
  editionName,
  onClose,
  onSaved,
}: SubmissionModalProps) {
  const { data: papers, error, loading } = useApi<Paper[]>("/papers");
  const [mode, setMode] = useState("existing");
  const [paperId, setPaperId] = useState("");
  const [title, setTitle] = useState("");
  const [abstract, setAbstract] = useState("");
  const [override, setOverride] = useState("");
  const [hideTitle, setHideTitle] = useState(false);
  const [status, setStatus] = useState<SubmissionStatus>("interested");
  const mutation = useMutation();
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.run(
      async () => {
        let id = Number(paperId || papers?.[0]?.id);
        if (mode === "new" || !papers?.length)
          id = (
            await api<Paper>("/papers", {
              method: "POST",
              body: { title, abstract },
            })
          ).id;
        await api("/submissions", {
          method: "POST",
          body: {
            paper_id: id,
            edition_id: editionId,
            status,
            hide_title: hideTitle,
            abstract_override: override || null,
          },
        });
      },
      () => {
        onSaved();
        onClose();
      }
    );
  }
  return (
    <Modal title="Add my talk" onClose={onClose}>
      <p className="mb-5 text-sm text-muted">
        A possible next stage:{" "}
        <span className="font-semibold text-ink">{editionName}</span>
      </p>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <Notice tone="error">{error}</Notice>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          {!!papers?.length && (
            <SegmentedControl
              value={mode}
              onChange={setMode}
              label="Choose a talk"
              options={[
                { value: "existing", label: "From my library" },
                { value: "new", label: "New talk" },
              ]}
            />
          )}
          {mode === "existing" && !!papers?.length ? (
            <Field label="Your talk">
              <Select
                value={paperId || papers[0].id}
                onChange={(e) => setPaperId(e.target.value)}
              >
                {papers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <>
              <Field label="Talk title">
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="What's your big idea?"
                />
              </Field>
              <Field label="Abstract (private)">
                <Textarea
                  value={abstract}
                  onChange={(e) => setAbstract(e.target.value)}
                  placeholder="The story you want to tell…"
                />
              </Field>
            </>
          )}
          <Field label="Submission status">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as SubmissionStatus)}
            >
              {SUBMISSION_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Abstract for this edition (optional)"
            hint="A tailored version, without changing your original talk."
          >
            <Textarea
              rows={3}
              value={override}
              onChange={(e) => setOverride(e.target.value)}
            />
          </Field>
          <Checkbox
            label="Hide talk title from the crew"
            checked={hideTitle}
            onChange={(e) => setHideTitle(e.target.checked)}
          />
          <p className="flex items-center gap-2 text-xs text-muted">
            <LockKeyhole size={13} />
            Your abstract is always private. Only you can see it.
          </p>
          {mutation.error && <Notice tone="error">{mutation.error}</Notice>}
          <div className="flex justify-end gap-2 border-t border-divider pt-5">
            <Button onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" loading={mutation.busy}>
              <Plus size={16} />
              Add my talk
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
