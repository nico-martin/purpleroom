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
              body: { title },
            })
          ).id;
        await api("/submissions", {
          method: "POST",
          body: {
            paper_id: id,
            edition_id: editionId,
            status,
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
            </>
          )}
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
          <p className="text-xs text-muted">
            Talk titles and submission statuses are always private.
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
