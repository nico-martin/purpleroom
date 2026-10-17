import { useState } from "react";
import type { FormEvent } from "react";

import { api } from "../api";
import useMutation from "../hooks/useMutation";
import { REVIEW_TAGS } from "../lib/constants";
import {
  Button,
  Field,
  Modal,
  Notice,
  SegmentedControl,
  Tag,
  Textarea,
} from "../theme";
import type { Review, ReviewTag } from "../types";

interface ReviewEditorProps {
  conferenceId: number;
  review?: Review;
  onClose: () => void;
  onSaved: () => void;
  className?: string;
}
export default function ReviewEditor({
  conferenceId,
  review,
  onClose,
  onSaved,
}: ReviewEditorProps) {
  const [tags, setTags] = useState<ReviewTag[]>(review?.tags ?? []);
  const [text, setText] = useState(review?.text ?? "");
  const [again, setAgain] = useState(
    review?.would_submit_again === 1
      ? "yes"
      : review?.would_submit_again === 0
        ? "no"
        : "unsure"
  );
  const { busy, error, run } = useMutation();
  function submit(event: FormEvent) {
    event.preventDefault();
    run(
      () =>
        api(`/conferences/${conferenceId}/review`, {
          method: "PUT",
          body: {
            tags,
            text,
            would_submit_again: again === "yes" ? 1 : again === "no" ? 0 : null,
          },
        }),
      () => {
        onSaved();
        onClose();
      }
    );
  }
  return (
    <Modal
      title={review ? "Edit my speaker take" : "Share a speaker take"}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-6">
        <div>
          <p className="mb-3 text-sm font-semibold">The things that matter</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(REVIEW_TAGS).map(([key, label]) => (
              <Tag
                key={key}
                selected={tags.includes(key as ReviewTag)}
                onClick={() =>
                  setTags((current) =>
                    current.includes(key as ReviewTag)
                      ? current.filter((tag) => tag !== key)
                      : [...current, key as ReviewTag]
                  )
                }
              >
                {label}
              </Tag>
            ))}
          </div>
        </div>
        <Field label="Your speaker take">
          <Textarea
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What would you tell a friend before they submit?"
          />
        </Field>
        <div>
          <p className="mb-3 text-sm font-semibold">Would you submit again?</p>
          <SegmentedControl
            value={again}
            onChange={setAgain}
            label="Would you submit again?"
            options={[
              { value: "yes", label: "Yes, gladly" },
              { value: "unsure", label: "Not sure" },
              { value: "no", label: "Not for me" },
            ]}
          />
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-divider pt-5">
          {review && (
            <Button
              variant="danger"
              disabled={busy}
              className="mr-auto"
              onClick={() => {
                if (confirm("Delete your speaker take?"))
                  run(
                    () =>
                      api(`/conferences/${conferenceId}/review`, {
                        method: "DELETE",
                      }),
                    () => {
                      onSaved();
                      onClose();
                    }
                  );
              }}
            >
              Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" loading={busy}>
            Save my take
          </Button>
        </div>
      </form>
    </Modal>
  );
}
