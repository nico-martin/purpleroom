import { Route, Routes } from "react-router-dom";

import AppShell from "./components/AppShell";
import AuthPage from "./pages/AuthPage";
import ConferenceDetailPage from "./pages/ConferenceDetailPage";
import ConferenceFormPage from "./pages/ConferenceFormPage";
import ConferencesPage from "./pages/ConferencesPage";
import CrewPage from "./pages/CrewPage";
import DashboardPage from "./pages/DashboardPage";
import EditionDetailPage from "./pages/EditionDetailPage";
import EditionFormPage from "./pages/EditionFormPage";
import SettingsPage from "./pages/SettingsPage";
import TalkDetailPage from "./pages/TalkDetailPage";
import TalksPage from "./pages/TalksPage";
import TrashPage from "./pages/TrashPage";
import { ButtonLink, EmptyState } from "./theme";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthPage mode="login" />} />
      <Route path="/auth/:token" element={<AuthPage mode="verify" />} />
      <Route path="/invite/:token" element={<AuthPage mode="invite" />} />
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="conferences" element={<ConferencesPage />} />
        <Route path="conferences/new" element={<ConferenceFormPage />} />
        <Route path="conferences/:id" element={<ConferenceDetailPage />} />
        <Route path="conferences/:id/edit" element={<ConferenceFormPage />} />
        <Route path="editions/new" element={<EditionFormPage />} />
        <Route path="editions/:id" element={<EditionDetailPage />} />
        <Route path="editions/:id/edit" element={<EditionFormPage />} />
        <Route path="talks" element={<TalksPage />} />
        <Route path="talks/:id" element={<TalkDetailPage />} />
        <Route path="crew" element={<CrewPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="trash" element={<TrashPage />} />
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
