import { Monitor, Moon, Sun } from "lucide-react";

import cn from "../../utils/classnames";
import { Button, SegmentedControl } from "../index";
import useColorScheme from "./useColorScheme";

interface ColorSchemeControlProps {
  compact?: boolean;
  className?: string;
}

const options = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

export default function ColorSchemeControl({
  compact = false,
  className = "",
}: ColorSchemeControlProps) {
  const { preference, setPreference } = useColorScheme();
  if (!compact)
    return (
      <SegmentedControl
        label="Colour theme"
        value={preference}
        options={[...options]}
        onChange={setPreference}
        className={className}
      />
    );

  const currentIndex = options.findIndex(
    (option) => option.value === preference
  );
  const current = options[currentIndex];
  const next = options[(currentIndex + 1) % options.length];
  const Icon =
    preference === "system" ? Monitor : preference === "light" ? Sun : Moon;
  const label = `Colour theme: ${current.label}. Switch to ${next.label.toLowerCase()} mode.`;
  return (
    <Button
      variant="ghost"
      className={cn("size-11 p-0", className)}
      aria-label={label}
      title={label}
      onClick={() => setPreference(next.value)}
    >
      <Icon size={18} strokeWidth={1.6} />
    </Button>
  );
}
