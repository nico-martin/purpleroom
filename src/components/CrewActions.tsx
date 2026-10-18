import { api } from "../api";
import useMutation from "../hooks/useMutation";
import { Button, Notice } from "../theme";
import type { Relationship } from "../types";

export default function CrewActions({
  id,
  name,
  relationship,
  onChanged,
}: {
  id: number;
  name: string;
  relationship: Relationship;
  onChanged: () => void;
}) {
  const mutation = useMutation();
  function act(action: string, method = "POST") {
    mutation.run(() => api(`/crew/${id}${action}`, { method }), onChanged);
  }
  if (relationship === "self")
    return <span className="text-xs text-muted">You</span>;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {relationship === "none" && (
          <Button disabled={mutation.busy} onClick={() => act("/request")}>
            Add to crew
          </Button>
        )}
        {relationship === "incoming" && (
          <>
            <Button
              variant="primary"
              disabled={mutation.busy}
              onClick={() => act("/accept")}
            >
              Accept
            </Button>
            <Button disabled={mutation.busy} onClick={() => act("", "DELETE")}>
              Decline
            </Button>
          </>
        )}
        {relationship === "outgoing" && (
          <Button disabled={mutation.busy} onClick={() => act("", "DELETE")}>
            Cancel request
          </Button>
        )}
        {relationship === "friend" && (
          <Button
            disabled={mutation.busy}
            onClick={() => {
              if (confirm(`Remove ${name} from your crew?`)) act("", "DELETE");
            }}
          >
            Unfriend
          </Button>
        )}
        <Button
          variant="ghost"
          disabled={mutation.busy}
          onClick={() => {
            if (
              confirm(
                `Block ${name}? This removes your friendship and pending requests.`
              )
            )
              act("/block");
          }}
        >
          Block
        </Button>
      </div>
      {mutation.error && <Notice tone="error">{mutation.error}</Notice>}
    </div>
  );
}
