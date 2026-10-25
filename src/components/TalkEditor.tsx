import { LockKeyhole } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";

import { api } from "../api";
import useMutation from "../hooks/useMutation";
import { PAPER_AUDIENCE_LEVELS, PAPER_FORMATS } from "../lib/constants";
import { textCounts } from "../lib/text";
import {
  Button,
  Field,
  Input,
  Modal,
  Notice,
  Select,
  Textarea,
} from "../theme";
import type { AbstractVariant, Paper } from "../types";

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
  const [duration, setDuration] = useState(
    paper?.duration_minutes?.toString() ?? ""
  );
  const [audience, setAudience] = useState<string>(
    paper?.audience_level ?? ""
  );
  const [language, setLanguage] = useState(paper?.language ?? "");
  const [format, setFormat] = useState<string>(paper?.format ?? "");
  const [variants, setVariants] = useState<AbstractVariant[]>(
    paper?.abstract_variants ?? []
  );
  const [notes, setNotes] = useState(paper?.notes ?? "");
  const { busy, error, run } = useMutation();
  function updateVariant(index: number, change: Partial<AbstractVariant>) {
    setVariants(variants.map((v, i) => (i === index ? { ...v, ...change } : v)));
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    run(
      () =>
        api<Paper>(paper ? `/papers/${paper.id}` : "/papers", {
          method: paper ? "PATCH" : "POST",
          // Never send the legacy `abstract`; it stays stored as-is.
          body: {
            title,
            duration_minutes: duration === "" ? null : Number(duration),
            audience_level: audience || null,
            language,
            format: format || null,
            abstract_variants: variants,
            notes,
          },
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
        <Field label="Talk title" hint={textCounts(title)}>
          <Input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Give your idea a name"
          />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Duration (minutes)">
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              max={600}
              step={1}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </Field>
          <Field label="Language">
            <Input
              maxLength={100}
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="English"
            />
          </Field>
          <Field label="Audience level">
            <Select
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            >
              <option value="">Not set</option>
              {Object.entries(PAPER_AUDIENCE_LEVELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Format">
            <Select value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="">Not set</option>
              {Object.entries(PAPER_FORMATS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="border-t border-divider pt-5">
          <h3 className="text-xl">Abstract variants</h3>
          <p className="my-3 text-sm text-muted">
            Name each version, for example Short, Detailed, or Deutsch. Edit
            the text directly.
          </p>
          <div className="space-y-5">
            {variants.map((variant, i) => (
              <fieldset
                className="space-y-3 rounded-xl border border-border p-4"
                key={i}
              >
                <legend className="px-2 text-sm">Abstract variant {i + 1}</legend>
                <Field label={`Abstract variant ${i + 1} label`}>
                  <Input
                    required
                    maxLength={200}
                    value={variant.label}
                    onChange={(e) =>
                      updateVariant(i, { label: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label={`Abstract variant ${i + 1} text`}
                  hint={textCounts(variant.text)}
                >
                  <Textarea
                    required
                    maxLength={20000}
                    rows={6}
                    value={variant.text}
                    onChange={(e) => updateVariant(i, { text: e.target.value })}
                  />
                </Field>
                <Button
                  onClick={() =>
                    setVariants(variants.filter((_, j) => j !== i))
                  }
                >
                  Remove abstract variant {i + 1}
                </Button>
              </fieldset>
            ))}
          </div>
          <Button
            className="mt-4"
            disabled={variants.length >= 20}
            onClick={() => setVariants([...variants, { label: "", text: "" }])}
          >
            Add abstract variant
          </Button>
        </div>
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
          Only you can see your talk details, abstracts and notes.
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
