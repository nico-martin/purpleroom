import { useState } from "react";
import type { FormEvent } from "react";

import { api } from "../api";
import useMutation from "../hooks/useMutation";
import { browserTimezone } from "../lib/timezones";
import {
  Button,
  Field,
  Input,
  Modal,
  Notice,
  Textarea,
  TimezoneSelect,
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
  const [date, setDate] = useState(submission.submitted_on ?? "");
  const [timezone, setTimezone] = useState(
    submission.submitted_timezone ??
      (submission.submitted_on ? "" : browserTimezone())
  );
  const [notes, setNotes] = useState(submission.notes ?? "");
  const { busy, error, run } = useMutation();
  function submit(event: FormEvent) {
    event.preventDefault();
    run(
      () =>
        api(`/submissions/${submission.id}`, {
          method: "PATCH",
          body: {
            submitted_on: date || null,
            submitted_timezone: timezone || null,
            notes: notes || null,
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
        <Field label="Submitted on">
          <Input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              if (e.target.value && !timezone) setTimezone(browserTimezone());
            }}
          />
        </Field>
        <Field
          label="Submission date timezone"
          hint="Only you can see the submission date and timezone."
        >
          <TimezoneSelect value={timezone} onChange={setTimezone} />
        </Field>
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
        <p className="text-xs text-muted">
          Talk titles and submission statuses are always private.
        </p>
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
