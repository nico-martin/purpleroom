import { Plus } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { api } from "../api";
import useApi from "../hooks/useApi";
import useMutation from "../hooks/useMutation";
import { SUBMISSION_STATUS_OPTIONS } from "../lib/constants";
import {
  Button,
  Field,
  Input,
  LoadingState,
  Modal,
  Notice,
  SegmentedControl,
  Select,
  Textarea,
} from "../theme";
import type { Paper, Submission, SubmissionStatus } from "../types";

interface SubmissionModalProps {
  editionId: number;
  editionName: string;
  submission?: Submission;
  onClose: () => void;
  onSaved: () => void;
  className?: string;
}
export default function SubmissionModal({
  editionId,
  editionName,
  submission,
  onClose,
  onSaved,
}: SubmissionModalProps) {
  const { data: papers, error, loading } = useApi<Paper[]>("/papers");
  const [selectedMode, setMode] = useState<string | null>(null);
  const mode = selectedMode ?? (papers?.length ? "existing" : "new");
  const [paperId, setPaperId] = useState("");
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<SubmissionStatus>("interested");
  const [notes, setNotes] = useState("");
  const mutation = useMutation();
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.run(
      async () => {
        let id: number | null =
          mode === "unassigned" ? null : Number(paperId || papers?.[0]?.id);
        if (mode === "new")
          id = (
            await api<Paper>("/papers", {
              method: "POST",
              body: { title },
            })
          ).id;
        await api(
          submission ? `/submissions/${submission.id}` : "/submissions",
          {
            method: submission ? "PATCH" : "POST",
            body: submission
              ? { paper_id: id }
              : {
                  paper_id: id,
                  edition_id: editionId,
                  status,
                  notes: notes || null,
                },
          }
        );
      },
      () => {
        onSaved();
        onClose();
      }
    );
  }
  return (
    <Modal
      title={submission ? "Attach a talk" : "Add my talk"}
      onClose={onClose}
    >
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
          <SegmentedControl
            value={mode}
            onChange={setMode}
            label="Choose a talk"
            options={[
              { value: "existing", label: "From my library" },
              { value: "new", label: "New talk" },
              ...(!submission
                ? [{ value: "unassigned", label: "Topic to be agreed" }]
                : []),
            ]}
          />
          {mode === "unassigned" ? (
            <Notice>
              No specific talk yet? Track the speaking opportunity now and
              attach a talk later. Nothing is added to your talk library.
            </Notice>
          ) : mode === "existing" ? (
            papers?.length ? (
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
              <Notice>
                Your library is empty. Choose New talk to create one.
              </Notice>
            )
          ) : (
            <Field label="Talk title">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="What's your big idea?"
              />
            </Field>
          )}
          {!submission && (
            <Field label="Submission status">
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as SubmissionStatus)}
              >
                {SUBMISSION_STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s[0].toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {submission && (
            <p className="text-sm text-muted">
              Attaching a talk keeps this submission's status and submission
              date.
            </p>
          )}
          {!submission && (
            <Field
              label="Private notes (optional)"
              hint="Only you can see these notes. They belong to this submission, not the reusable talk."
            >
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                maxLength={100000}
                placeholder="Organiser conversations, follow-ups, or details for this edition…"
              />
            </Field>
          )}
          <p className="text-xs text-muted">
            Talk titles and submission statuses are always private.
          </p>
          {mutation.error && <Notice tone="error">{mutation.error}</Notice>}
          <div className="flex justify-end gap-2 border-t border-divider pt-5">
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="submit"
              variant="primary"
              loading={mutation.busy}
              disabled={mode === "existing" && !papers?.length}
            >
              <Plus size={16} />
              {submission
                ? "Attach talk"
                : mode === "unassigned"
                  ? "Add opportunity"
                  : "Add my talk"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
