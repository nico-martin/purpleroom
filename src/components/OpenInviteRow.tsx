import { Clock3, Copy, Link2, Trash2 } from "lucide-react";
import { useState } from "react";

import { api } from "../api";
import useMutation from "../hooks/useMutation";
import { formatDate } from "../lib/format";
import {
  Button,
  CopyButton,
  CopyField,
  ListRow,
  Modal,
  Notice,
} from "../theme";
import type { Invite } from "../types";

interface OpenInviteRowProps {
  invite: Invite;
  onChanged: () => void;
  className?: string;
}

export default function OpenInviteRow({
  invite,
  onChanged,
  className = "",
}: OpenInviteRowProps) {
  const deletion = useMutation();
  const copying = useMutation();
  const [copyUrl, setCopyUrl] = useState<string | null>(null);
  function copyLink() {
    if (
      !confirm(
        "This invitation's original link isn't available for copying. Create a replacement? The old link will stop working, and the expiry date will stay the same."
      )
    )
      return;
    copying.run(async () => {
      const result = await api<{ url: string }>(
        `/invites/${invite.id}/regenerate`,
        { method: "POST" }
      );
      setCopyUrl(result.url);
      onChanged();
    });
  }
  function remove() {
    const target = invite.email ? ` for ${invite.email}` : "";
    if (
      !confirm(
        `Delete this invitation${target}? The shared link will stop working immediately.`
      )
    )
      return;
    deletion.run(
      () => api(`/invites/${invite.id}`, { method: "DELETE" }),
      onChanged
    );
  }
  return (
    <ListRow className={className}>
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-divider text-muted">
        <Link2 size={17} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="break-words text-sm">
          {invite.email || "An open seat at the table"}
        </p>
        <p className="mt-1 text-xs text-muted">
          Invited by {invite.invited_by.name}
        </p>
      </div>
      <span className="flex items-center gap-2 font-mono text-xs text-muted">
        <Clock3 size={13} />
        Until{" "}
        {formatDate(invite.expires_at, { day: "numeric", month: "short" })}
      </span>
      <div className="flex items-center gap-1">
        {invite.url ? (
          <CopyButton
            variant="ghost"
            disabled={deletion.busy}
            value={invite.url}
            label={`invitation link${invite.email ? ` for ${invite.email}` : ` from ${invite.invited_by.name}`}`}
          />
        ) : (
          <Button
            variant="ghost"
            loading={copying.busy}
            disabled={deletion.busy}
            onClick={copyLink}
            aria-label={`Copy invitation link${invite.email ? ` for ${invite.email}` : ` from ${invite.invited_by.name}`}`}
          >
            <Copy size={15} />
            Copy link
          </Button>
        )}
        <Button
          variant="ghost"
          loading={deletion.busy}
          disabled={copying.busy}
          onClick={remove}
          aria-label={`Delete invitation${invite.email ? ` for ${invite.email}` : ` from ${invite.invited_by.name}`}`}
          className="hover:text-urgent-ink"
        >
          <Trash2 size={15} />
          Delete
        </Button>
      </div>
      {(deletion.error || copying.error) && (
        <Notice tone="error" className="w-full">
          {deletion.error || copying.error}
        </Notice>
      )}
      {copyUrl && (
        <Modal title="Copy invitation link" onClose={() => setCopyUrl(null)}>
          <Notice tone="success" className="mb-4">
            Replacement link ready. The old link no longer works.
          </Notice>
          <CopyField value={copyUrl} label="invite link" />
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setCopyUrl(null)}>Done</Button>
          </div>
        </Modal>
      )}
    </ListRow>
  );
}
