import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";

import cn from "../../utils/classnames";
import { Button } from "../index";

interface ModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
}
export default function Modal({
  title,
  children,
  onClose,
  className = "",
}: ModalProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    node?.showModal();
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        "fixed inset-0 m-auto max-h-11/12 w-11/12 max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-0 text-ink backdrop:bg-ink/40",
        className
      )}
    >
      <div className="flex items-center justify-between border-b border-divider px-6 py-4">
        <h2 className="text-xl">{title}</h2>
        <Button
          variant="ghost"
          className="size-11 p-0"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={18} />
        </Button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  );
}
