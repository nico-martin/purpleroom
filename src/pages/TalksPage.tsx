import { LockKeyhole, Mic2, Plus } from "lucide-react";
import { useState } from "react";

import TalkCard from "../components/TalkCard";
import TalkEditor from "../components/TalkEditor";
import useApi from "../hooks/useApi";
import {
  Button,
  Card,
  EmptyState,
  LoadingState,
  Notice,
  PageHeader,
} from "../theme";
import type { Paper } from "../types";

interface TalksPageProps {
  className?: string;
}
export default function TalksPage({ className = "" }: TalksPageProps) {
  const { data, loading, error, refresh } = useApi<Paper[]>("/papers");
  const [creating, setCreating] = useState(false);
  return (
    <div className={className}>
      <PageHeader
        eyebrow="Your personal purpleroom"
        title="Ideas looking for a stage."
        description="Your talk library, from first idea to front row. Your notes are just for you."
        action={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Plus size={16} />
            New talk
          </Button>
        }
      />
      <div className="mb-7 flex items-center gap-2 text-xs text-muted">
        <LockKeyhole size={14} />
        Private library. Your talk titles, notes, and submission statuses are
        only visible to you.
      </div>
      {loading && !data ? (
        <LoadingState />
      ) : error ? (
        <Notice tone="error">{error}</Notice>
      ) : data?.length ? (
        <ul
          aria-label="My talks"
          className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        >
          {data.map((paper) => (
            <li key={paper.id} className="min-w-0">
              <TalkCard paper={paper} onSaved={refresh} />
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState
            title="It starts with an idea."
            description="Keep your talk ideas and private notes in one place. When a good CFP comes along, you'll be ready."
            action={
              <Button variant="dashed" onClick={() => setCreating(true)}>
                <Plus size={15} />
                Write your first talk
              </Button>
            }
            icon={<Mic2 size={22} strokeWidth={1.5} />}
          />
        </Card>
      )}
      {creating && (
        <TalkEditor onClose={() => setCreating(false)} onSaved={refresh} />
      )}
    </div>
  );
}
