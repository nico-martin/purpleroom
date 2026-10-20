import { useState } from "react";

import { Card, CopyButton, Field, Select } from "../theme";
import type { SpeakerBio } from "../types";

export default function SpeakerBios({ bios }: { bios: SpeakerBio[] }) {
  const [selected, setSelected] = useState(0);
  if (!bios.length) return null;
  const index = Math.min(selected, bios.length - 1);
  const bio = bios[index];
  return (
    <Card padded className="space-y-4">
      <Field label="Bio variant">
        <Select
          value={String(index)}
          onChange={(event) => setSelected(Number(event.target.value))}
        >
          {bios.map((variant, i) => (
            <option key={i} value={i}>
              {variant.label}
            </option>
          ))}
        </Select>
      </Field>
      <CopyButton
        key={index}
        appearance="text"
        value={bio.text}
        label={`${bio.label} bio`}
      />
    </Card>
  );
}
