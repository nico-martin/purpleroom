import { ArchiveRestore, Trash2 } from "lucide-react";

import { api } from "../api";
import useApi from "../hooks/useApi";
import useMutation from "../hooks/useMutation";
import { relativeTime } from "../lib/format";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ListRow,
  LoadingState,
  Notice,
  PageHeader,
} from "../theme";
import type { Conference, Edition } from "../types";

interface TrashPageProps {
  className?: string;
}
interface Trash {
  conferences: Conference[];
  editions: (Edition & { conference_name: string })[];
}
export default function TrashPage({ className = "" }: TrashPageProps) {
  const { data, loading, error, refresh } = useApi<Trash>("/trash");
  const mutation = useMutation();
  const items = [
    ...(data?.conferences ?? []).map((c) => ({
      ...c,
      label: c.name,
      kind: "conferences",
    })),
    ...(data?.editions ?? []).map((e) => ({
      ...e,
      label: `${e.conference_name} ${e.year}`,
      kind: "editions",
    })),
  ];
  return (
    <div className={className}>
      <PageHeader
        eyebrow="Nothing lost backstage"
        title="A second chance."
        description="Conferences and editions deleted in the last 90 days. Anyone in the crew can bring them back."
      />
      {mutation.error && (
        <Notice tone="error" className="mb-5">
          {mutation.error}
        </Notice>
      )}
      {loading ? (
        <LoadingState />
      ) : error ? (
        <Notice tone="error">{error}</Notice>
      ) : (
        <Card>
          {items.length ? (
            items.map((item) => (
              <ListRow key={`${item.kind}-${item.id}`}>
                <span className="flex size-11 items-center justify-center rounded-xl bg-divider text-muted">
                  <Trash2 size={18} strokeWidth={1.5} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-base">{item.label}</h2>
                  <p className="mt-1 font-mono text-xs text-muted">
                    Deleted {relativeTime(item.deleted_at!)}
                  </p>
                </div>
                <Badge className="hidden sm:inline-flex">
                  {item.kind === "conferences" ? "Conference" : "Edition"}
                </Badge>
                <Button
                  disabled={mutation.busy}
                  onClick={() =>
                    mutation.run(
                      () =>
                        api(`/${item.kind}/${item.id}/restore`, {
                          method: "POST",
                        }),
                      refresh
                    )
                  }
                >
                  <ArchiveRestore size={15} />
                  Restore
                </Button>
              </ListRow>
            ))
          ) : (
            <EmptyState
              title="Nothing left behind."
              description="Recently deleted conferences and editions will show up here. Your room is looking tidy."
              icon={<ArchiveRestore size={22} strokeWidth={1.5} />}
            />
          )}
        </Card>
      )}
      <p className="mt-5 text-xs text-muted">
        If an edition's conference was deleted too, restore the conference
        first.
      </p>
    </div>
  );
}
