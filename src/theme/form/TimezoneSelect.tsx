import { useId, useState } from "react";
import type { SelectHTMLAttributes } from "react";

import { commonTimezoneOptions, timezoneOptions } from "../../lib/timezones";
import Input from "./Input";
import Select from "./Select";

interface TimezoneSelectProps extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "value" | "onChange"
> {
  value: string;
  onChange: (value: string) => void;
}
export default function TimezoneSelect({
  value,
  onChange,
  ...props
}: TimezoneSelectProps) {
  const [search, setSearch] = useState("");
  const id = useId();
  const query = search.trim().toLowerCase().replaceAll("_", " ");
  const cities = timezoneOptions(value).filter((zone) =>
    zone.replaceAll("_", " ").toLowerCase().includes(query)
  );
  return (
    <div className="min-w-0 space-y-2">
      <Select
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {!value && <option value="">Timezone not set (legacy date)</option>}
        {commonTimezoneOptions(value).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <p className="text-xs text-muted">
        Daylight saving adjusts automatically for the selected date.
      </p>
      <details className="text-sm">
        <summary className="cursor-pointer text-green">
          Choose a specific city
        </summary>
        <div className="mt-3 space-y-2">
          <label htmlFor={`${id}-search`} className="block text-xs text-muted">
            Search timezone cities
          </label>
          <Input
            id={`${id}-search`}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
            placeholder="e.g. Amsterdam or Tokyo"
            disabled={props.disabled}
          />
          <label htmlFor={`${id}-city`} className="block text-xs text-muted">
            Specific timezone city
          </label>
          <Select
            id={`${id}-city`}
            value={cities.includes(value) ? value : ""}
            onChange={(event) => {
              if (event.target.value) onChange(event.target.value);
            }}
            disabled={props.disabled}
          >
            <option value="" disabled>
              {cities.length ? "Choose a city…" : "No matching cities"}
            </option>
            {cities.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </div>
      </details>
    </div>
  );
}
