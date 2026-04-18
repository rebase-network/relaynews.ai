import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell, LEADERBOARD_DIRECTORY_PATH } from "./shared";
import { HomePage } from "./pages/home-page";
import { LeaderboardIndexPage } from "./pages/leaderboard-index-page";
import { LeaderboardPage } from "./pages/leaderboard-page";
import { MethodologyPage } from "./pages/methodology-page";
import { NotFoundPage } from "./pages/not-found-page";
import { ProbePage } from "./pages/probe-page";
import { RelayPage } from "./pages/relay-page";
import { SubmitPage } from "./pages/submit-page";

export function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/leaderboard" element={<LeaderboardPage />} />
        <Route path={LEADERBOARD_DIRECTORY_PATH} element={<LeaderboardIndexPage />} />
        <Route path="/leaderboard/:modelKey" element={<LeaderboardPage />} />
        <Route path="/relay/:slug" element={<RelayPage />} />
        <Route path="/methodology" element={<MethodologyPage />} />
        <Route path="/policy" element={<Navigate replace to="/methodology#governance" />} />
        <Route path="/submit" element={<SubmitPage />} />
        <Route path="/probe" element={<ProbePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppShell>
  );
}
