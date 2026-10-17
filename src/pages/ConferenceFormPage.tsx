import { ArrowLeft, ArrowRight, Link2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../api";
import useMutation from "../hooks/useMutation";
import {
  Button,
  ButtonLink,
  Card,
  Field,
  Input,
  LoadingState,
  Notice,
  PageHeader,
  Textarea,
} from "../theme";
import type { Conference } from "../types";

interface ConferenceFormPageProps {
  className?: string;
}
export default function ConferenceFormPage({
  className = "",
}: ConferenceFormPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const mutation = useMutation();
  const metadata = useMutation();
  const [form, setForm] = useState({
    name: "",
    website: "",
    logo_url: "",
    description: "",
  });
  const [loading, setLoading] = useState(!!id);
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (id)
      api<Conference>(`/conferences/${id}`)
        .then((c) =>
          setForm({
            name: c.name,
            website: c.website ?? "",
            logo_url: c.logo_url ?? "",
            description: c.description ?? "",
          })
        )
        .catch((e: Error) => mutation.setError(e.message))
        .finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  function submit(event: FormEvent) {
    event.preventDefault();
    mutation.run(
      () =>
        api<Conference>(id ? `/conferences/${id}` : "/conferences", {
          method: id ? "PATCH" : "POST",
          body: form,
        }),
      (c) => navigate(`/conferences/${c.id}`)
    );
  }
  function prefill() {
    metadata.run(
      () =>
        api<Partial<Conference>>("/conferences/metadata", {
          method: "POST",
          body: { url: form.website },
        }),
      (result) => {
        setForm((value) => ({
          ...value,
          name: result.name || value.name,
          description: result.description || value.description,
          logo_url: result.logo_url || value.logo_url,
        }));
        setPrefilled(true);
      }
    );
  }
  return (
    <div className={className}>
      <ButtonLink
        to={id ? `/conferences/${id}` : "/conferences"}
        variant="ghost"
        className="-ml-4 mb-5"
      >
        <ArrowLeft size={15} />
        Back to conferences
      </ButtonLink>
      <PageHeader
        title={id ? "A little update." : "Put a good stage on the map."}
        description="Start with the conference. Dates and CFP details belong to its editions."
      />
      <Card padded className="max-w-2xl">
        {loading ? (
          <LoadingState />
        ) : (
          <form onSubmit={submit} className="space-y-6">
            <Field
              label="Conference website"
              hint="Paste a URL and we'll try to fill in the basics."
            >
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input
                  type="url"
                  placeholder="https://a-great-conference.com"
                  value={form.website}
                  onChange={(e) =>
                    setForm({ ...form, website: e.target.value })
                  }
                />
                <Button
                  onClick={prefill}
                  loading={metadata.busy}
                  disabled={!form.website}
                >
                  <Sparkles size={15} />
                  Get details
                </Button>
              </div>
            </Field>
            {metadata.error && <Notice tone="error">{metadata.error}</Notice>}
            {prefilled && (
              <Notice tone="success">
                Details checked. Give them a once-over before saving.
              </Notice>
            )}
            <div className="border-t border-divider" />
            <Field label="Conference name">
              <Input
                required
                placeholder="e.g. JSNation"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </Field>
            <Field
              label="A little context"
              hint="What's it about? Why does it belong on our shortlist?"
            >
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="The kind of conference you'd tell a friend about…"
              />
            </Field>
            <Field
              label="Logo URL (optional)"
              hint="No logo? We'll make a little initials tile instead."
            >
              <div className="relative">
                <Link2
                  size={16}
                  className="absolute left-3 top-3.5 text-muted"
                />
                <Input
                  type="url"
                  className="pl-10"
                  value={form.logo_url}
                  onChange={(e) =>
                    setForm({ ...form, logo_url: e.target.value })
                  }
                  placeholder="https://…"
                />
              </div>
            </Field>
            {mutation.error && <Notice tone="error">{mutation.error}</Notice>}
            <div className="flex justify-end gap-3 border-t border-divider pt-6">
              <ButtonLink to={id ? `/conferences/${id}` : "/conferences"}>
                Cancel
              </ButtonLink>
              <Button type="submit" variant="primary" loading={mutation.busy}>
                {id ? "Save changes" : "Add conference"}
                <ArrowRight size={15} />
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
