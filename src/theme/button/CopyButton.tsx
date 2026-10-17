import { Check, Copy } from "lucide-react";
import { useState } from "react";
import type { ComponentProps, ReactNode } from "react";

import { Button, CopyField, Modal } from "../index";

interface CopyButtonProps extends Omit<
  ComponentProps<typeof Button>,
  "onClick" | "children" | "loading"
> {
  value: string;
  label: string;
  children?: ReactNode;
}

export default function CopyButton({
  value,
  label,
  children = "Copy link",
  className = "",
  disabled = false,
  ...props
}: CopyButtonProps) {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState(false);
  const copied = copiedValue === value;
  async function copy() {
    setBusy(true);
    try {
      await navigator.clipboard.writeText(value);
      setCopiedValue(value);
    } catch {
      setFallback(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Button
        {...props}
        className={className}
        disabled={disabled}
        loading={busy}
        aria-label={`Copy ${label}`}
        onClick={copy}
      >
        {copied ? <Check size={15} /> : <Copy size={15} />}
        {copied ? "Copied" : children}
      </Button>
      <span role="status" className="sr-only">
        {copied ? `${label} copied.` : ""}
      </span>
      {fallback && (
        <Modal title="Copy link" onClose={() => setFallback(false)}>
          <CopyField value={value} label={label} />
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setFallback(false)}>Done</Button>
          </div>
        </Modal>
      )}
    </>
  );
}
