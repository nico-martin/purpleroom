import { api } from "../api";
import useApi from "../hooks/useApi";
import useMutation from "../hooks/useMutation";
import useSession from "../hooks/useSession";
import {
  Avatar,
  Badge,
  Button,
  Card,
  LoadingState,
  Notice,
  PageHeader,
} from "../theme";
import type { AdminUser } from "../types";

export default function AdminPage() {
  const { user, refreshMe } = useSession();
  const { data, error, loading, refresh } = useApi<AdminUser[]>("/admin/users");
  const mutation = useMutation();
  function change(id: number, body: Record<string, unknown>, message: string) {
    if (confirm(message))
      mutation.run(
        () => api(`/admin/users/${id}`, { method: "PATCH", body }),
        () => {
          refresh();
          refreshMe();
        }
      );
  }
  return (
    <div>
      <PageHeader
        title="Manage members"
        description="Manage roles and account access. Private proposals and statuses remain private, including from admins."
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
          {data?.map((u) => (
            <div
              key={u.id}
              role="group"
              aria-label={`Manage ${u.name || `member ${u.id}`}`}
              className="flex flex-wrap items-center gap-4 border-b border-divider p-5 last:border-0"
            >
              <Avatar name={u.name || "New member"} src={u.avatar_url} />
              <div className="min-w-0 flex-1">
                <h2>
                  {u.name || "Profile incomplete"}
                  {u.id === user.id ? " (you)" : ""}
                </h2>
                <p className="text-xs text-muted">Member #{u.id}</p>
              </div>
              <Badge tone={u.suspended ? "urgent" : "neutral"}>
                {u.suspended ? "Suspended" : u.role}
              </Badge>
              <Button
                disabled={mutation.busy}
                onClick={() =>
                  change(
                    u.id,
                    { role: u.role === "admin" ? "member" : "admin" },
                    `Change ${u.name || "this member"} to ${u.role === "admin" ? "member" : "admin"}?`
                  )
                }
              >
                {u.role === "admin" ? "Demote" : "Promote"}
              </Button>
              <Button
                disabled={mutation.busy}
                onClick={() =>
                  change(
                    u.id,
                    { suspended: !u.suspended },
                    `${u.suspended ? "Restore" : "Suspend"} ${u.name || "this account"}?`
                  )
                }
              >
                {u.suspended ? "Restore access" : "Suspend"}
              </Button>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
