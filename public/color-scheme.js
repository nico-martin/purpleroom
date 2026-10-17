// Runs before the stylesheet/app so the saved browser preference is applied before paint.
(() => {
  const root = document.documentElement;
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const valid = (value) => ["light", "dark", "system"].includes(value);
  const read = () => {
    try {
      const value = document.cookie
        .split(";")
        .map((part) => part.trim())
        .find((part) => part.startsWith("gr_theme="))
        ?.slice(9);
      return valid(value) ? value : "system";
    } catch {
      return "system";
    }
  };
  let preference = read();
  const apply = () => {
    root.dataset.themePreference = preference;
    root.dataset.theme =
      preference === "system" ? (media.matches ? "dark" : "light") : preference;
    window.dispatchEvent(new Event("green-room:theme-change"));
  };
  apply();

  window.addEventListener("green-room:set-theme", (event) => {
    if (!valid(event.detail)) return;
    preference = event.detail;
    try {
      const secure = location.protocol === "https:" ? "; Secure" : "";
      document.cookie = `gr_theme=${preference}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
    } catch {
      // A blocked cookie must not prevent changing the theme for this page.
    }
    apply();
  });
  media.addEventListener("change", apply);
  const sync = () => {
    preference = read();
    apply();
  };
  window.addEventListener("focus", sync);
  window.addEventListener("pageshow", sync);
})();
