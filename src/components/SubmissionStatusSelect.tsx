import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { api } from "../api";
import useMutation from "../hooks/useMutation";
import { SUBMISSION_STATUSES } from "../lib/constants";
import { Button, Notice, Select } from "../theme";
import type { Submission } from "../types";
import SubmissionEditor from "./SubmissionEditor";

interface SubmissionStatusSelectProps {
  submission: Submission;
  onSaved: () => void;
  className?: string;
}
export default function SubmissionStatusSelect({
  submission,
  onSaved,
  className = "",
}: SubmissionStatusSelectProps) {
  const { busy, error, run } = useMutation();
  const [editing, setEditing] = useState(false);
  return (
    <div className={className}>
      <div className="flex items-center gap-1">
        <Select
          aria-label={`Status for ${submission.paper_title ?? submission.conference?.name ?? "talk"}`}
          disabled={busy}
          value={submission.status}
          onChange={(e) =>
            run(
              () =>
                api(`/submissions/${submission.id}`, {
                  method: "PATCH",
                  body: { status: e.target.value },
                }),
              onSaved
            )
          }
        >
          {SUBMISSION_STATUSES.map((s) => (
            <option value={s} key={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </Select>
        <Button
          aria-label="Edit submission details"
          variant="ghost"
          className="size-11 p-0"
          onClick={() => setEditing(true)}
        >
          <Pencil size={14} />
        </Button>
        <Button
          aria-label="Remove submission"
          variant="ghost"
          className="size-11 p-0"
          disabled={busy}
          onClick={() => {
            if (
              confirm(
                "Remove this submission? Your talk stays in your library."
              )
            )
              run(
                () =>
                  api(`/submissions/${submission.id}`, { method: "DELETE" }),
                onSaved
              );
          }}
        >
          <Trash2 size={14} />
        </Button>
      </div>
      {error && (
        <Notice tone="error" className="mt-2">
          {error}
        </Notice>
      )}
      {editing && (
        <SubmissionEditor
          submission={submission}
          onSaved={onSaved}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}
