import { useState } from "react";
import { Link } from "react-router-dom";

import useApi from "../hooks/useApi";
import { Card, Field, LoadingState, Notice, Select } from "../theme";
import type { Paper } from "../types";
import TalkCopyDetails from "./TalkCopyDetails";

/**
 * Toolkit talk picker: reads the owner-only talk library and shows the
 * selected talk's copy actions. Selection is local UI state, like bio variants.
 */
export default function SpeakerTalks() {
  const { data, error, loading } = useApi<Paper[]>("/papers");
  const [selected, setSelected] = useState<number | null>(null);
  if (loading && !data) return <LoadingState />;
  if (error || !data)
    return (
      <Notice tone="error">{error ?? "Could not load your talks."}</Notice>
    );
  if (!data.length)
    return (
      <Card padded>
        <p className="text-sm text-muted">
          No talks in your private library yet.
        </p>
        <Link
          to="/talks/new"
          className="mt-3 inline-flex min-h-11 items-center text-sm text-green underline underline-offset-4"
        >
          Create a talk
        </Link>
      </Card>
    );
  const paper = data.find((talk) => talk.id === selected) ?? data[0];
  return (
    <Card padded className="space-y-5">
      <Field label="Talk">
        <Select
          value={String(paper.id)}
          onChange={(event) => setSelected(Number(event.target.value))}
        >
          {data.map((talk) => (
            <option key={talk.id} value={talk.id}>
              {talk.title}
            </option>
          ))}
        </Select>
      </Field>
      <TalkCopyDetails key={paper.id} paper={paper} />
      <Link
        to={`/talks/${paper.id}`}
        className="inline-flex min-h-11 items-center px-3 text-sm text-green underline underline-offset-4"
      >
        Edit this talk
      </Link>
    </Card>
  );
}
