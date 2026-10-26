import { AlertTriangle, LockKeyhole } from "lucide-react";
import { Fragment, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import AgendaCalendar from "../components/AgendaCalendar";
import useApi from "../hooks/useApi";
import { upcomingPlans } from "../lib/agenda";
import { dateRange, editionLabel } from "../lib/format";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  LoadingState,
  Notice,
  PageHeader,
  SegmentedControl,
} from "../theme";
import type { AgendaPlan } from "../types";

function statusLabel(status: AgendaPlan["status"]) {
  return status === "going" ? "Going" : "Maybe (tentative)";
}

export default function AgendaPage() {
  const { data, error, loading } = useApi<{ plans: AgendaPlan[] }>(
    "/me/agenda"
  );
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "list" ? "list" : "calendar";
  const plans = useMemo(() => upcomingPlans(data?.plans ?? []), [data]);
  function setValue(key: string, value: string | null) {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );
  }
  return (
    <div>
      <PageHeader
        eyebrow="Your personal purpleroom"
        title="My agenda."
        description="Your upcoming Going and Maybe plans, with a heads-up when dates overlap."
      />
      <div className="mb-7 flex items-center gap-2 text-xs text-muted">
        <LockKeyhole size={14} />
        Private agenda. Only you can see this page.
      </div>
      {loading && !data ? (
        <LoadingState />
      ) : error || !data ? (
        <Notice tone="error">
          {error ?? "Your agenda could not be loaded."}
        </Notice>
      ) : plans.length ? (
        <>
          <SegmentedControl
            label="Agenda view"
            className="mb-5"
            value={view}
            options={[
              { value: "calendar", label: "Calendar" },
              { value: "list", label: "List" },
            ]}
            onChange={(value) =>
              setValue("view", value === "list" ? "list" : null)
            }
          />
          {view === "calendar" ? (
            <AgendaCalendar
              plans={plans}
              monthParam={params.get("month")}
              onMonthChange={(month) => setValue("month", month)}
              statusLabel={statusLabel}
            />
          ) : (
            <Card>
              <ul aria-label="My agenda">
                {plans.map(({ status, edition, conference, conflicts }) => {
                  const undated = !edition.starts_on && !edition.ends_on;
                  return (
                    <li
                      key={edition.id}
                      className="flex flex-wrap items-start justify-between gap-3 border-b border-divider p-5 last:border-0"
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
                        <p className="break-words text-xs text-muted">
                          {undated ? (
                            "Dates unknown, conflicts can't be checked"
                          ) : (
                            <>
                              {dateRange(edition)}
                              {!edition.ends_on && " · End date not set"}
                              {!edition.starts_on && " · Start date not set"}
                            </>
                          )}
                        </p>
                        {conflicts.length > 0 && (
                          <p className="mt-3 flex items-start gap-2 rounded-xl bg-soon p-3 text-sm text-soon-ink">
                            <AlertTriangle
                              size={16}
                              className="mt-0.5 shrink-0"
                              aria-hidden="true"
                            />
                            <span className="min-w-0 break-words">
                              Overlaps with{" "}
                              {conflicts.map((conflict, index) => (
                                <Fragment key={conflict.edition_id}>
                                  {index > 0 && ", "}
                                  <Link
                                    to={`/editions/${conflict.edition_id}`}
                                    className="font-semibold underline"
                                  >
                                    {conflict.label}
                                  </Link>{" "}
                                  ({statusLabel(conflict.status)})
                                </Fragment>
                              ))}
                            </span>
                          </p>
                        )}
                      </div>
                      <Badge tone={status === "going" ? "positive" : "neutral"}>
                        {statusLabel(status)}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </>
      ) : (
        <EmptyState
          title="Nothing on your agenda yet."
          description="Mark an edition as Going or Maybe and it will show up here."
          action={<ButtonLink to="/conferences">Browse conferences</ButtonLink>}
        />
      )}
    </div>
  );
}
