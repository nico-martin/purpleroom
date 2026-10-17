import { useSyncExternalStore } from "react";

export type ColorScheme = "light" | "dark" | "system";

function subscribe(callback: () => void) {
  window.addEventListener("green-room:theme-change", callback);
  return () => window.removeEventListener("green-room:theme-change", callback);
}

function snapshot(): ColorScheme {
  const value = document.documentElement.dataset.themePreference;
  return value === "light" || value === "dark" ? value : "system";
}

export default function useColorScheme() {
  const preference = useSyncExternalStore(
    subscribe,
    snapshot,
    () => "system" as ColorScheme
  );
  function setPreference(value: ColorScheme) {
    window.dispatchEvent(
      new CustomEvent("green-room:set-theme", { detail: value })
    );
  }
  return { preference, setPreference };
}
