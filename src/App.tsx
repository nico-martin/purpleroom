import { Route, Routes } from "react-router-dom";

import AdminOnly from "./components/AdminOnly";
import AppShell from "./components/AppShell";
import AdminPage from "./pages/AdminPage";
import AuthPage from "./pages/AuthPage";
import ConferenceDetailPage from "./pages/ConferenceDetailPage";
import ConferenceFormPage from "./pages/ConferenceFormPage";
import ConferencesPage from "./pages/ConferencesPage";
import CrewPage from "./pages/CrewPage";
import DashboardPage from "./pages/DashboardPage";
import EditionDetailPage from "./pages/EditionDetailPage";
import EditionFormPage from "./pages/EditionFormPage";
import MemberPage from "./pages/MemberPage";
import PublicSpeakerPage from "./pages/PublicSpeakerPage";
import SettingsPage from "./pages/SettingsPage";
import SetupPage from "./pages/SetupPage";
import SpeakerPage from "./pages/SpeakerPage";
import SpeakerSettingsPage from "./pages/SpeakerSettingsPage";
import TalkDetailPage from "./pages/TalkDetailPage";
import TalksPage from "./pages/TalksPage";
import TrashPage from "./pages/TrashPage";
import { ButtonLink, EmptyState } from "./theme";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/setup" element={<SetupPage />} />
      <Route path="/u/:username" element={<PublicSpeakerPage />} />
      <Route path="/auth/:token" element={<AuthPage mode="verify" />} />
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="conferences" element={<ConferencesPage />} />
        <Route
          path="conferences/new"
          element={
            <AdminOnly>
              <ConferenceFormPage />
            </AdminOnly>
          }
        />
        <Route path="conferences/:id" element={<ConferenceDetailPage />} />
        <Route
          path="conferences/:id/edit"
          element={
            <AdminOnly>
              <ConferenceFormPage />
            </AdminOnly>
          }
        />
        <Route
          path="editions/new"
          element={
            <AdminOnly>
              <EditionFormPage />
            </AdminOnly>
          }
        />
        <Route path="editions/:id" element={<EditionDetailPage />} />
        <Route
          path="editions/:id/edit"
          element={
            <AdminOnly>
              <EditionFormPage />
            </AdminOnly>
          }
        />
        <Route path="talks" element={<TalksPage />} />
        <Route path="talks/:id" element={<TalkDetailPage />} />
        <Route path="crew" element={<CrewPage />} />
        <Route path="members/:id" element={<MemberPage />} />
        <Route
          path="admin"
          element={
            <AdminOnly>
              <AdminPage />
            </AdminOnly>
          }
        />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="settings/speaker" element={<SpeakerSettingsPage />} />
        <Route path="speaker" element={<SpeakerPage />} />
        <Route
          path="trash"
          element={
            <AdminOnly>
              <TrashPage />
            </AdminOnly>
          }
        />
        <Route
          path="*"
          element={
            <EmptyState
              title="A little offstage."
              description="This page doesn't exist. Let's get you back to the room."
              action={<ButtonLink to="/">Back to the room</ButtonLink>}
            />
          }
        />
      </Route>
    </Routes>
  );
}
