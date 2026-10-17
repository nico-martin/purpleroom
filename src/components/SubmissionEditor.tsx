import { useState } from "react";
import type { FormEvent } from "react";

import { api } from "../api";
import useMutation from "../hooks/useMutation";
import {
  Button,
  Checkbox,
  Field,
  Input,
  Modal,
  Notice,
  Textarea,
} from "../theme";
import type { Submission } from "../types";

interface SubmissionEditorProps {
  submission: Submission;
  onSaved: () => void;
  onClose: () => void;
  className?: string;
}
export default function SubmissionEditor({
  submission,
  onSaved,
  onClose,
}: SubmissionEditorProps) {
  const [abstract, setAbstract] = useState(submission.abstract_override ?? "");
  const [hide, setHide] = useState(!!submission.hide_title);
  const [date, setDate] = useState(submission.submitted_on ?? "");
  const { busy, error, run } = useMutation();
  function submit(event: FormEvent) {
    event.preventDefault();
    run(
      () =>
        api(`/submissions/${submission.id}`, {
          method: "PATCH",
          body: {
            abstract_override: abstract || null,
            hide_title: hide,
            submitted_on: date || null,
          },
        }),
      () => {
        onSaved();
        onClose();
      }
    );
  }
  return (
    <Modal title="The details of this submission" onClose={onClose}>
      <form className="space-y-5" onSubmit={submit}>
        <Field
          label="Abstract for this edition"
          hint="Private to you. Leave empty to use your talk's original abstract."
        >
          <Textarea
            rows={7}
            value={abstract}
            onChange={(e) => setAbstract(e.target.value)}
          />
        </Field>
        <Field label="Submitted on">
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Checkbox
          label="Hide talk title from the crew"
          checked={hide}
          onChange={(e) => setHide(e.target.checked)}
        />
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end gap-2 border-t border-divider pt-5">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={busy}>
            Save submission
          </Button>
        </div>
      </form>
    </Modal>
  );
}
