import { ArrowLeft, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { api } from "../api";
import useMutation from "../hooks/useMutation";
import {
  Button,
  ButtonLink,
  Card,
  Checkbox,
  Field,
  Input,
  LoadingState,
  Notice,
  PageHeader,
  Select,
  Textarea,
} from "../theme";
import type { ConferenceDetail, ConferenceSummary, Edition } from "../types";

interface EditionFormPageProps {
  className?: string;
}
const empty = {
  conference_id: "",
  year: String(new Date().getFullYear()),
  city: "",
  country: "",
  online: false,
  starts_on: "",
  ends_on: "",
  website: "",
  cfp_url: "",
  cfp_opens_on: "",
  cfp_closes_on: "",
  notes: "",
};
export default function EditionFormPage({
  className = "",
}: EditionFormPageProps) {
  const { id } = useParams();
  const [search] = useSearchParams();
  const conferenceId = search.get("conference");
  const navigate = useNavigate();
  const mutation = useMutation();
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [conferences, setConferences] = useState<ConferenceSummary[]>([]);
  const [form, setForm] = useState({
    ...empty,
    conference_id: conferenceId ?? "",
  });
  useEffect(() => {
    async function load() {
      const list = await api<ConferenceSummary[]>("/conferences");
      setConferences(list);
      if (id) {
        const e = await api<Edition>(`/editions/${id}`);
        setForm({
          conference_id: String(e.conference_id),
          year: String(e.year),
          city: e.city ?? "",
          country: e.country ?? "",
          online: !!e.online,
          starts_on: e.starts_on ?? "",
          ends_on: e.ends_on ?? "",
          website: e.website ?? "",
          cfp_url: e.cfp_url ?? "",
          cfp_opens_on: e.cfp_opens_on ?? "",
          cfp_closes_on: e.cfp_closes_on ?? "",
          notes: e.notes ?? "",
        });
      } else if (conferenceId) {
        const c = await api<ConferenceDetail>(`/conferences/${conferenceId}`);
        const previous = c.editions[0];
        if (previous) {
          setForm((current) => ({
            ...current,
            year: String(previous.year + 1),
            city: previous.city ?? "",
            country: previous.country ?? "",
            online: !!previous.online,
            website: previous.website ?? c.website ?? "",
            cfp_url: previous.cfp_url ?? "",
            notes: previous.notes ?? "",
          }));
          setCopied(true);
        }
      }
    }
    load()
      .catch((e: Error) => mutation.setError(e.message))
      .finally(() => setLoading(false));
  }, [id, conferenceId]); // eslint-disable-line react-hooks/exhaustive-deps
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.run(
      () =>
        api<Edition>(id ? `/editions/${id}` : "/editions", {
          method: id ? "PATCH" : "POST",
          body: {
            ...form,
            conference_id: Number(form.conference_id),
            year: Number(form.year),
          },
        }),
      (e) => navigate(`/editions/${e.id}`)
    );
  }
  function textField(key: keyof typeof form, label: string, type = "text") {
    return (
      <Field label={label}>
        <Input
          type={type}
          value={String(form[key])}
          onChange={(e) =>
            setForm({
              ...form,
              [key]:
                key === "country"
                  ? e.target.value.toUpperCase()
                  : e.target.value,
            })
          }
          maxLength={key === "country" ? 2 : undefined}
        />
      </Field>
    );
  }
  return (
    <div className={className}>
      <ButtonLink
        to={
          id
            ? `/editions/${id}`
            : conferenceId
              ? `/conferences/${conferenceId}`
              : "/conferences"
        }
        variant="ghost"
        className="-ml-4 mb-5"
      >
        <ArrowLeft size={15} />
        Back
      </ButtonLink>
      <PageHeader
        title={id ? "Keep the details fresh." : "A new chapter, a new stage."}
        description="The when, the where, and the all-important call for papers."
      />
      <Card padded className="max-w-3xl">
        {loading ? (
          <LoadingState />
        ) : (
          <form onSubmit={submit} className="space-y-6">
            {copied && (
              <Notice>
                We carried over the last edition's location and links, and moved
                the year forward. Add the new dates below.
              </Notice>
            )}
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Conference">
                <Select
                  required
                  value={form.conference_id}
                  onChange={(e) =>
                    setForm({ ...form, conference_id: e.target.value })
                  }
                >
                  <option value="">Choose a conference</option>
                  {conferences.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              {textField("year", "Year", "number")}
              {textField("city", "City")}
              {textField("country", "Country code (e.g. NL)")}
            </div>
            <Checkbox
              label="This is an online conference"
              checked={form.online}
              onChange={(e) => setForm({ ...form, online: e.target.checked })}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              {textField("starts_on", "First day", "date")}
              {textField("ends_on", "Last day", "date")}
            </div>
            {textField("website", "Edition website", "url")}
            <div className="border-t border-divider pt-6">
              <h2 className="mb-5 text-xl">Call for papers</h2>
              <div className="grid gap-5 sm:grid-cols-2">
                {textField("cfp_opens_on", "CFP opens", "date")}
                {textField("cfp_closes_on", "CFP closes", "date")}
              </div>
            </div>
            {textField("cfp_url", "CFP link", "url")}
            <Field label="Notes for the crew">
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Anything else worth knowing?"
              />
            </Field>
            {mutation.error && <Notice tone="error">{mutation.error}</Notice>}
            <div className="flex justify-end gap-3 border-t border-divider pt-6">
              <ButtonLink to={id ? `/editions/${id}` : "/conferences"}>
                Cancel
              </ButtonLink>
              <Button type="submit" variant="primary" loading={mutation.busy}>
                {id ? "Save changes" : "Add edition"}
                <ArrowRight size={15} />
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
