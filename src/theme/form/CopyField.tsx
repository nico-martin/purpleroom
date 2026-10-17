import { Check, Copy } from "lucide-react";
import { useState } from "react";

import cn from "../../utils/classnames";
import { Button, Input } from "../index";

interface CopyFieldProps {
  value: string;
  label: string;
  className?: string;
}
export default function CopyField({
  value,
  label,
  className = "",
}: CopyFieldProps) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex gap-2">
        <Input
          aria-label={label}
          value={value}
          readOnly
          className="font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <Button onClick={copy} aria-label={`Copy ${label}`}>
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <p role="status" className="text-xs text-muted">
        {failed
          ? "Clipboard unavailable. Select the link above and copy it manually."
          : copied
            ? "Copied. You're all set."
            : ""}
      </p>
    </div>
  );
}
