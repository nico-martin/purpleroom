import { useState } from "react";
import { Link } from "react-router-dom";

import { api } from "../api";
import CrewActions from "../components/CrewActions";
import useApi from "../hooks/useApi";
import useMutation from "../hooks/useMutation";
import {
  Avatar,
  Button,
  Card,
  EmptyState,
  Input,
  LoadingState,
  Notice,
  PageHeader,
  SectionHeader,
  SegmentedControl,
} from "../theme";
import type { CrewRequests, Member } from "../types";

export default function CrewPage({ className = "" }: { className?: string }) {
  const members = useApi<Member[]>("/users");
  const requests = useApi<CrewRequests>("/crew");
  const mutation = useMutation();
  const [tab, setTab] = useState("friends");
  const [search, setSearch] = useState("");
  const incoming = requests.data?.incoming.length ?? 0;
  function refresh() {
    members.refresh();
    requests.refresh();
  }
  const shown =
    members.data?.filter(
      (u) =>
        (tab === "directory" ||
          (tab === "friends" && u.relationship === "friend") ||
          (tab === "requests" &&
            ["incoming", "outgoing"].includes(u.relationship))) &&
        u.name.toLowerCase().includes(search.toLowerCase())
    ) ?? [];
  return (
    <div className={className}>
      <PageHeader
        eyebrow="Your people, your crew"
        title="Good company."
        description="Find members, connect with friends, and see where your crew is heading."
      />
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <SegmentedControl
          label="Crew view"
          value={tab}
          onChange={setTab}
          options={[
            { value: "friends", label: "My crew" },
            { value: "directory", label: "All members" },
            {
              value: "requests",
              label: `Requests${incoming ? ` (${incoming})` : ""}`,
            },
            { value: "blocked", label: "Blocked" },
          ]}
        />
        <Input
          className="sm:max-w-xs"
          aria-label="Search members"
          placeholder="Find a member…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      {members.loading || requests.loading ? (
        <LoadingState />
      ) : members.error || requests.error ? (
        <Notice tone="error">{members.error || requests.error}</Notice>
      ) : tab === "blocked" ? (
        <section>
          <SectionHeader title="Blocked members" />
          <Card padded>
            {requests.data?.blocked.length ? (
              requests.data.blocked.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-divider py-4 last:border-0"
                >
                  <span>{u.name}</span>
                  <Button
                    disabled={mutation.busy}
                    onClick={() =>
                      mutation.run(
                        () => api(`/crew/${u.id}/block`, { method: "DELETE" }),
                        refresh
                      )
                    }
                  >
                    Unblock
                  </Button>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">No blocked members.</p>
            )}
            {mutation.error && <Notice tone="error">{mutation.error}</Notice>}
          </Card>
        </section>
      ) : (
        <section>
          <SectionHeader
            title={
              tab === "friends"
                ? "My crew"
                : tab === "requests"
                  ? "Pending requests"
                  : "Member directory"
            }
            count={shown.length}
          />
          {shown.length ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((u) => (
                <Card padded key={u.id}>
                  <Link
                    to={`/members/${u.id}`}
                    className="mb-4 flex items-center gap-3"
                  >
                    <Avatar name={u.name} src={u.avatar_url} />
                    <span>
                      <span className="block font-heading text-lg hover:text-purple">
                        {u.name}
                      </span>
                      <span className="text-xs text-muted">
                        {u.relationship === "friend"
                          ? "In your crew"
                          : u.relationship === "incoming"
                            ? "Wants to join your crew"
                            : u.relationship === "outgoing"
                              ? "Request sent"
                              : "Member"}
                      </span>
                    </span>
                  </Link>
                  <CrewActions
                    id={u.id}
                    name={u.name}
                    relationship={u.relationship}
                    onChanged={refresh}
                  />
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <EmptyState
                title={
                  tab === "friends" ? "Find your people." : "All caught up."
                }
                description={
                  tab === "friends"
                    ? "Browse All members and send a crew request. Only accepted friends can see your plans and reviews."
                    : "No members match this view."
                }
              />
            </Card>
          )}
        </section>
      )}
    </div>
  );
}
