import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import AppFooter from "../components/AppFooter";
import ShareableTemplate from "../components/ShareableTemplate";
import SpeakerProfileView from "../components/SpeakerProfileView";
import SpeakerShareCard from "../components/SpeakerShareCard";
import useApi from "../hooks/useApi";
import {
  Brand,
  Card,
  ColorSchemeControl,
  LoadingState,
  Notice,
} from "../theme";
import type { SpeakerProfile } from "../types";

export default function PublicSpeakerPage() {
  const { username = "" } = useParams();
  const [renderShareable, setRenderShareable] = useState(
    window.location.hash === "#render-shareable"
  );
  useEffect(() => {
    const changed = () =>
      setRenderShareable(window.location.hash === "#render-shareable");
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, []);
  const { data, loading, error } = useApi<SpeakerProfile>(
    `/public/speakers/${encodeURIComponent(username)}`
  );
  if (renderShareable)
    return data && !error && !loading ? (
      <>
        <ShareableTemplate>
          <SpeakerShareCard profile={data} />
        </ShareableTemplate>
        <SpeakerShareCard profile={data} />
      </>
    ) : (
      <Notice>
        {loading
          ? "Loading published speaker profile…"
          : "Speaker profile not found."}
      </Notice>
    );
  return (
    <div className="mx-auto max-w-4xl px-5 py-8 sm:px-8">
      <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
        <Brand />
        <ColorSchemeControl />
      </header>
      <main>
        {loading ? (
          <LoadingState />
        ) : error || !data ? (
          <Notice tone="error">{error ?? "Speaker profile not found."}</Notice>
        ) : (
          <>
            <SpeakerProfileView profile={data} />
            <ShareableTemplate>
              <SpeakerShareCard profile={data} />
            </ShareableTemplate>
            <section
              className="mt-10"
              aria-label="Profile data and integrations"
            >
              <Card padded>
                <h2 className="text-lg">Profile data and integrations</h2>
                <p className="mt-2 text-sm text-muted">
                  Building an event website or speaker tool? Reuse this
                  speaker’s published profile as structured data. These
                  read-only resources need no sign-in and are separate from the
                  speaker’s personal links.
                </p>
                <div className="mt-5 grid gap-5 sm:grid-cols-2">
                  <div className="space-y-1">
                    <a
                      className="text-sm text-green underline underline-offset-4"
                      href={`/api/public/speakers/${encodeURIComponent(username)}`}
                    >
                      Public JSON API
                    </a>
                    <p className="text-sm text-muted">
                      The published information for this speaker, in JSON
                      format.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <a
                      className="text-sm text-green underline underline-offset-4"
                      href="/speaker-openapi.json"
                    >
                      OpenAPI documentation
                    </a>
                    <p className="text-sm text-muted">
                      The API specification describing available fields and
                      endpoints.
                    </p>
                  </div>
                </div>
              </Card>
            </section>
          </>
        )}
      </main>
      <AppFooter className="mt-10" />
    </div>
  );
}
