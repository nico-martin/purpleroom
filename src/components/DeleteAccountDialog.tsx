import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../api";
import useMutation from "../hooks/useMutation";
import { Button, Field, Input, Modal, Notice } from "../theme";

export default function DeleteAccountDialog({
  onClose,
}: {
  onClose: () => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const { busy, error, run } = useMutation();
  const navigate = useNavigate();
  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || confirmation !== "DELETE") return;
    run(
      () => api("/me", { method: "DELETE", body: { confirmation } }),
      () => {
        sessionStorage.removeItem("green-room-next");
        sessionStorage.removeItem("green-room-login-code");
        navigate("/login?deleted=1", { replace: true });
      }
    );
  }
  return (
    <Modal
      title="Permanently delete your account?"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={submit} className="space-y-5">
        <Notice tone="error">
          This cannot be undone. Your account and all personal content will be
          permanently deleted.
        </Notice>
        <p className="text-sm text-muted">
          This includes your profile and images, talks, submissions and private
          notes, reviews, attendance, and crew relationships. You will be signed
          out on all devices.
        </p>
        <p className="text-sm text-muted">
          Shared conferences and editions you created will remain, without your
          attribution. Signing up again will create a new account, not restore
          your content.
        </p>
        <Field label="Type DELETE to confirm">
          <Input
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            disabled={busy}
            required
          />
        </Field>
        <p className="text-xs text-muted">
          Existing server backups follow the site's retention policy.
        </p>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-divider pt-5">
          <Button onClick={onClose} disabled={busy}>
            Keep my account
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={confirmation !== "DELETE"}
            loading={busy}
          >
            Permanently delete account
          </Button>
        </div>
      </form>
    </Modal>
  );
}
