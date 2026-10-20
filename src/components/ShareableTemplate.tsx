import { useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

export default function ShareableTemplate({
  children,
}: {
  children: ReactNode;
}) {
  const [template, setTemplate] = useState<HTMLTemplateElement | null>(null);
  return (
    <>
      <template data-shareable ref={setTemplate} />
      {template && createPortal(children, template.content)}
    </>
  );
}
