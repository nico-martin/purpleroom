import { CopyButton } from "../theme";

export default function SpeakerProfileLink({
  url,
  label,
  rel = "noreferrer",
  children,
}: {
  url: string;
  label: string;
  rel?: string;
  children?: string;
}) {
  return (
    <div className="flex w-fit min-w-0 max-w-full items-center rounded-lg hover:bg-divider">
      <CopyButton appearance="icon" value={url} label={`${label} URL`} />
      <a
        href={url}
        aria-label={label}
        target="_blank"
        rel={rel}
        className="min-w-0 flex-1 break-words py-2.5 pr-3 leading-relaxed text-green underline underline-offset-4"
      >
        {children ?? url}
      </a>
    </div>
  );
}
