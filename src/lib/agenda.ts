import type { AgendaPlan } from "../types";

const pad = (value: number) => String(value).padStart(2, "0");

/** Browser-local calendar date as `YYYY-MM-DD`. */
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Inclusive calendar-day range of a plan, matching `api/routes/agenda.php`:
 * a one-date edition is a single day, and legacy rows with end before start
 * are ordered. Undated plans return `null`.
 */
export function planRange(
  edition: Pick<AgendaPlan["edition"], "starts_on" | "ends_on">
): [string, string] | null {
  const dates = [edition.starts_on, edition.ends_on].filter(
    (date): date is string => !!date
  );
  if (!dates.length) return null;
  dates.sort();
  return [dates[0], dates[dates.length - 1]];
}

/**
 * The server keeps plans until their last day is over everywhere; drop plans
 * that already ended on the viewer's local date, and conflicts naming them.
 */
export function upcomingPlans(
  plans: AgendaPlan[],
  today = localDate()
): AgendaPlan[] {
  const visible = plans.filter((plan) => {
    const range = planRange(plan.edition);
    return !range || range[1] >= today;
  });
  const ids = new Set(visible.map((plan) => plan.edition.id));
  return visible.map((plan) => ({
    ...plan,
    conflicts: plan.conflicts.filter((conflict) =>
      ids.has(conflict.edition_id)
    ),
  }));
}
