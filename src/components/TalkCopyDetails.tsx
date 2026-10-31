import { PAPER_AUDIENCE_LEVELS, PAPER_FORMATS } from "../lib/constants";
import { formatDuration } from "../lib/duration";
import { textCounts } from "../lib/text";
import { CopyButton } from "../theme";
import type { Paper } from "../types";

/** Read-only copy actions for one talk's shared details and abstract variants. */
export default function TalkCopyDetails({ paper }: { paper: Paper }) {
  // [label, copied value, displayed text, hint]
  const details: [string, string, string, string?][] = [
    ["Title", paper.title, paper.title, textCounts(paper.title)],
  ];
  if (paper.duration_minutes !== null) {
    const duration = formatDuration(paper);
    details.push(["Duration in minutes", duration, `${duration} minutes`]);
  }
  if (paper.audience_level) {
    const level = PAPER_AUDIENCE_LEVELS[paper.audience_level];
    details.push(["Audience level", level, level]);
  }
  if (paper.language)
    details.push(["Language", paper.language, paper.language]);
  if (paper.format) {
    const format = PAPER_FORMATS[paper.format];
    details.push(["Format", format, format]);
  }
  return (
    <div className="space-y-5">
      <div className="space-y-3">
        {details.map(([label, value, shown, hint]) => (
          <div key={label} className="space-y-1">
            <p className="px-3 text-xs text-muted">{label}</p>
            <CopyButton
              appearance="text"
              value={value}
              label={label.toLowerCase()}
            >
              {shown}
            </CopyButton>
            {hint && <p className="px-3 text-xs text-muted">{hint}</p>}
          </div>
        ))}
      </div>
      <section
        aria-label="Abstract variants"
        className="space-y-5 border-t border-divider pt-5"
      >
        <h3 className="px-3 text-base">Abstract variants</h3>
        {paper.abstract_variants.length ? (
          paper.abstract_variants.map((variant, i) => (
            <div key={i} className="space-y-1">
              <h4 className="px-3 text-sm font-semibold">{variant.label}</h4>
              <CopyButton
                appearance="text"
                value={variant.text}
                label={`${variant.label} abstract`}
              />
              <p className="px-3 text-xs text-muted">
                {textCounts(variant.text)}
              </p>
            </div>
          ))
        ) : (
          <p className="px-3 text-sm text-muted">
            No abstract variants saved for this talk yet.
          </p>
        )}
      </section>
    </div>
  );
}
