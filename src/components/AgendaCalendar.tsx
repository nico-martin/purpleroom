import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { useId } from "react";
import { Link } from "react-router-dom";

import { dateRange, editionLabel } from "../lib/format";
import { Badge, Button } from "../theme";
import type { AgendaPlan } from "../types";
import cn from "../utils/classnames";

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const COL_START = [
  "col-start-1",
  "col-start-2",
  "col-start-3",
  "col-start-4",
  "col-start-5",
  "col-start-6",
  "col-start-7",
];
const COL_SPAN = [
  "col-span-1",
  "col-span-2",
  "col-span-3",
  "col-span-4",
  "col-span-5",
  "col-span-6",
  "col-span-7",
];
const ROW_START = [
  "row-start-1",
  "row-start-2",
  "row-start-3",
  "row-start-4",
  "row-start-5",
  "row-start-6",
  "row-start-7",
  "row-start-8",
];
const GOING = "bg-purple text-on-purple";
const MAYBE = "border border-dashed border-purple bg-surface text-ink";

const pad = (value: number) => String(value).padStart(2, "0");

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
}
function shiftMonth(month: string, delta: number): string {
  const date = new Date(
    Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)) - 1 + delta, 1)
  );
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;
}
const monthTitle = (month: string) =>
  new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00Z`));
const dayTitle = (date: string) =>
  new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

interface Segment {
  plan: AgendaPlan;
  first: boolean;
  col: number;
  span: number;
  lane: number;
}

interface AgendaCalendarProps {
  plans: AgendaPlan[];
  /** Raw `?month=` value; absent or invalid shows the browser's current month. */
  monthParam: string | null;
  /** Receives `null` for the current month so the default stays out of the URL. */
  onMonthChange: (month: string | null) => void;
  statusLabel: (status: AgendaPlan["status"]) => string;
}
export default function AgendaCalendar({
  plans,
  monthParam,
  onMonthChange,
  statusLabel,
}: AgendaCalendarProps) {
  const headingId = useId();
  const today = currentMonth();
  const month =
    monthParam && /^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)
      ? monthParam
      : today;
  const goTo = (delta: number) => {
    const next = shiftMonth(month, delta);
    onMonthChange(next === today ? null : next);
  };
  const year = Number(month.slice(0, 4));
  const monthIndex = Number(month.slice(5)) - 1;
  const days = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const lead = (new Date(Date.UTC(year, monthIndex, 1)).getUTCDay() + 6) % 7;
  const weekCount = Math.ceil((lead + days) / 7);
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-${pad(days)}`;

  const weeks: { segments: Segment[]; lanes: boolean[][] }[] = Array.from(
    { length: weekCount },
    () => ({ segments: [], lanes: [] })
  );
  const coverage = new Array<number>(days + 1).fill(0);
  for (const plan of plans) {
    const start = plan.edition.starts_on ?? plan.edition.ends_on;
    const end = plan.edition.ends_on ?? plan.edition.starts_on;
    if (!start || !end || end < monthStart || start > monthEnd) continue;
    const firstDay = Number((start < monthStart ? monthStart : start).slice(8));
    const lastDay = Number((end > monthEnd ? monthEnd : end).slice(8));
    for (let day = firstDay; day <= lastDay; day++) coverage[day]++;
    const firstCell = lead + firstDay - 1;
    const lastCell = lead + lastDay - 1;
    for (
      let week = Math.floor(firstCell / 7);
      week <= Math.floor(lastCell / 7);
      week++
    ) {
      const col = Math.max(firstCell, week * 7) % 7;
      const span = (Math.min(lastCell, week * 7 + 6) % 7) - col + 1;
      const { lanes, segments } = weeks[week];
      let lane = lanes.findIndex((used) =>
        used.slice(col, col + span).every((taken) => !taken)
      );
      if (lane < 0) lane = lanes.push(new Array<boolean>(7).fill(false)) - 1;
      lanes[lane].fill(true, col, col + span);
      segments.push({
        plan,
        first: week === Math.floor(firstCell / 7),
        col,
        span,
        lane,
      });
    }
  }
  const hasDated = coverage.some((count) => count > 0);
  const undated = plans.filter(
    (plan) => !plan.edition.starts_on && !plan.edition.ends_on
  );
  const title = monthTitle(month);

  return (
    <section aria-labelledby={headingId}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Button
          compact
          aria-label="Previous month"
          onClick={() => goTo(-1)}
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </Button>
        <h2
          id={headingId}
          aria-live="polite"
          className="min-w-0 text-center text-xl"
        >
          {title}
        </h2>
        <Button
          compact
          aria-label="Next month"
          onClick={() => goTo(1)}
        >
          <ChevronRight size={16} aria-hidden="true" />
        </Button>
      </div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className={cn("h-3 w-6 rounded-sm", GOING)} />
          Going
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn("h-3 w-6 rounded-sm", MAYBE)} />
          Maybe (tentative)
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        <div
          aria-hidden="true"
          className="grid grid-cols-7 bg-divider text-center text-xs font-semibold text-muted"
        >
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} className="min-w-0 py-1.5">
              {weekday}
            </div>
          ))}
        </div>
        {weeks.map(({ segments }, week) => (
          <div key={week} className="relative border-t border-divider">
            <div aria-hidden="true" className="absolute inset-0 grid grid-cols-7">
              {WEEKDAYS.map((_, col) => {
                const day = week * 7 + col - lead + 1;
                return (
                  <div
                    key={col}
                    className={cn(
                      "min-w-0",
                      day >= 1 && day <= days && coverage[day] > 1 && "bg-soon"
                    )}
                  />
                );
              })}
            </div>
            <div className="relative grid grid-cols-7">
              {WEEKDAYS.map((_, col) => {
                const day = week * 7 + col - lead + 1;
                if (day < 1 || day > days)
                  return <div key={col} className="min-w-0" />;
                const overlap = coverage[day] > 1;
                return (
                  <div
                    key={col}
                    className={cn(
                      "flex min-w-0 items-center gap-1 px-1.5 pt-1 text-xs",
                      overlap ? "font-semibold text-soon-ink" : "text-muted"
                    )}
                  >
                    <span aria-hidden={overlap || undefined}>{day}</span>
                    {overlap && (
                      <>
                        <AlertTriangle
                          size={12}
                          className="shrink-0"
                          aria-hidden="true"
                        />
                        <span className="sr-only">
                          {dayTitle(`${month}-${pad(day)}`)}, overlapping plans
                        </span>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="relative grid min-h-8 grid-cols-7 gap-y-1 pt-1 pb-2">
              {segments.map(({ plan, first, col, span, lane }) => {
                const label = editionLabel(
                  { title: plan.edition.title ?? "" },
                  plan.conference.name
                );
                const name = [
                  label,
                  statusLabel(plan.status),
                  dateRange(plan.edition),
                ].join(", ");
                const overlaps = plan.conflicts.length
                  ? `, overlaps with ${plan.conflicts.map((conflict) => conflict.label).join(", ")}`
                  : "";
                return (
                  <Link
                    key={`${plan.edition.id}-${week}`}
                    to={`/editions/${plan.edition.id}`}
                    aria-label={first ? name + overlaps : undefined}
                    aria-hidden={first ? undefined : true}
                    tabIndex={first ? undefined : -1}
                    // ponytail: 8 literal lanes, then an inline row; a week with more concurrent plans is unlikely.
                    style={
                      lane >= ROW_START.length
                        ? { gridRowStart: lane + 1 }
                        : undefined
                    }
                    className={cn(
                      "mx-0.5 flex min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold",
                      COL_START[col],
                      COL_SPAN[span - 1],
                      ROW_START[lane],
                      plan.status === "going" ? GOING : MAYBE
                    )}
                  >
                    {plan.conflicts.length > 0 && (
                      <AlertTriangle
                        size={12}
                        className="shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span className="min-w-0 truncate">{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      {!hasDated && (
        <p className="mt-3 text-sm text-muted">No dated plans in {title}.</p>
      )}
      {undated.length > 0 && (
        <div className="mt-6">
          <h3 className="mb-2 text-base">Dates unknown</h3>
          <ul
            aria-label="Dates unknown"
            className="rounded-xl border border-border bg-surface"
          >
            {undated.map(({ status, edition, conference }) => (
              <li
                key={edition.id}
                className="flex flex-wrap items-start justify-between gap-3 border-b border-divider p-4 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <Link
                    to={`/editions/${edition.id}`}
                    className="block break-words font-semibold hover:text-purple"
                  >
                    {editionLabel(
                      { title: edition.title ?? "" },
                      conference.name
                    )}
                  </Link>
                  <p className="text-xs text-muted">
                    Dates unknown, conflicts can't be checked
                  </p>
                </div>
                <Badge tone={status === "going" ? "positive" : "neutral"}>
                  {statusLabel(status)}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
