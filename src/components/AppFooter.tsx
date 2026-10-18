import { APP_VERSION } from "../lib/version";
import cn from "../utils/classnames";

interface AppFooterProps {
  className?: string;
  showVersion?: boolean;
}

export default function AppFooter({
  className = "",
  showVersion = false,
}: AppFooterProps) {
  return (
    <footer
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5 text-xs text-muted",
        className
      )}
    >
      <p className="leading-relaxed">
        A project by{" "}
        <a
          href="https://nico.dev"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 hover:text-purple"
        >
          Nico Martin
        </a>
        <span className="px-2" aria-hidden="true">
          ·
        </span>
        <a
          href="https://github.com/nico-martin/purpleroom/"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4 hover:text-purple"
        >
          Open source on GitHub
        </a>
      </p>
      {showVersion && (
        <span aria-label="App version" className="font-mono">
          {APP_VERSION}
        </span>
      )}
    </footer>
  );
}
