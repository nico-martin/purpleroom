import { LockKeyhole } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { api } from "../api";
import useMutation from "../hooks/useMutation";
import { Button, Field, Input, Modal, Notice, Textarea } from "../theme";
import type { Paper } from "../types";

interface TalkEditorProps {
  paper?: Paper;
  onClose: () => void;
  onSaved: (paper: Paper) => void;
  className?: string;
}
export default function TalkEditor({
  paper,
  onClose,
  onSaved,
}: TalkEditorProps) {
  const [title, setTitle] = useState(paper?.title ?? "");
  const [notes, setNotes] = useState(paper?.notes ?? "");
  const { busy, error, run } = useMutation();
  function submit(event: FormEvent) {
    event.preventDefault();
    run(
      () =>
        api<Paper>(paper ? `/papers/${paper.id}` : "/papers", {
          method: paper ? "PATCH" : "POST",
          body: { title, notes },
        }),
      (result) => {
        onSaved(result);
        onClose();
      }
    );
  }
  return (
    <Modal
      title={paper ? "Make it your own." : "A new idea deserves a stage."}
      onClose={onClose}
    >
      <form className="space-y-5" onSubmit={submit}>
        <Field label="Talk title">
          <Input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your idea a name"
          />
        </Field>
        <Field label="Private notes">
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Work in progress, links, things to remember…"
          />
        </Field>
        <p className="flex items-center gap-2 text-xs text-muted">
          <LockKeyhole size={13} />
          Only you can see your notes.
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex justify-end gap-2 border-t border-divider pt-5">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={busy}>
            {paper ? "Save changes" : "Add to my library"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
