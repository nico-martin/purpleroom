import { Check, Copy } from "lucide-react";
import { useId, useState } from "react";
import type { ComponentProps, ReactNode } from "react";

import cn from "../../utils/classnames";
import { Button, CopyField, Modal } from "../index";

interface CopyButtonProps extends Omit<
  ComponentProps<typeof Button>,
  "onClick" | "children" | "loading"
> {
  value: string;
  label: string;
  children?: ReactNode;
  appearance?: "button" | "text" | "icon";
  tone?: "ink" | "muted" | "accent";
}

export default function CopyButton({
  value,
  label,
  children,
  appearance = "button",
  tone = "ink",
  variant = "secondary",
  className = "",
  disabled = false,
  compact = false,
  ...props
}: CopyButtonProps) {
  const [copiedValue, setCopiedValue] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState(false);
  const textId = useId();
  const copied = copiedValue === value;
  async function copy() {
    setBusy(true);
    setCopiedValue(null);
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
      {appearance !== "button" ? (
        <button
          {...props}
          type="button"
          className={cn(
            "inline-flex min-h-11 rounded-lg transition-colors hover:bg-divider focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green disabled:cursor-not-allowed disabled:opacity-50",
            tone === "ink"
              ? "text-ink"
              : tone === "muted"
                ? "text-muted"
                : "text-green",
            appearance === "text"
              ? "w-fit max-w-full items-center gap-3 px-3 py-2.5 text-left leading-relaxed"
              : "w-10 shrink-0 items-center justify-center",
            className
          )}
          disabled={disabled || busy}
          aria-label={`Copy ${label}`}
          aria-describedby={[
            props["aria-describedby"],
            appearance === "text" ? textId : undefined,
          ]
            .filter(Boolean)
            .join(" ")}
          aria-busy={busy}
          data-copied={copied}
          onClick={copy}
        >
          {copied ? (
            <Check
              aria-hidden="true"
              size={16}
              className="shrink-0 text-green"
            />
          ) : (
            <Copy
              aria-hidden="true"
              size={16}
              className="shrink-0 text-muted"
            />
          )}
          {appearance === "text" && (
            <span
              id={textId}
              className="min-w-0 whitespace-pre-wrap break-words"
            >
              {children ?? value}
            </span>
          )}
        </button>
      ) : (
        <Button
          {...props}
          variant={variant}
          compact={compact}
          className={className}
          disabled={disabled}
          loading={busy}
          aria-label={`Copy ${label}`}
          onClick={copy}
        >
          {!busy &&
            (copied ? (
              <Check aria-hidden="true" size={15} />
            ) : (
              <Copy aria-hidden="true" size={15} />
            ))}
          {copied ? "Copied" : (children ?? "Copy link")}
        </Button>
      )}
      <span role="status" className="sr-only">
        {copied ? `${label} copied.` : ""}
      </span>
      {fallback && (
        <Modal title={`Copy ${label}`} onClose={() => setFallback(false)}>
          <p role="status" className="mb-3 text-sm text-muted">
            Clipboard unavailable. Select the text below and copy it manually.
          </p>
          <CopyField value={value} label={label} />
          <div className="mt-4 flex justify-end">
            <Button onClick={() => setFallback(false)}>Done</Button>
          </div>
        </Modal>
      )}
    </>
  );
}
