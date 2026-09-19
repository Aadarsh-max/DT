import { Routes, Route } from "react-router-dom";
import { Hammer } from "lucide-react";
import AppLayout from "../layouts/AppLayout";
import AuthLayout from "../layouts/AuthLayout";
import ProtectedRoute from "./ProtectedRoute";
import Dashboard from "../pages/Dashboard";
import Login from "../pages/Login";
import Register from "../pages/Register";
import Settings from "../pages/Settings";
import Projects from "../pages/Projects";
import ProjectDetail from "../pages/ProjectDetail";
import TestCases from "../pages/TestCases";
import TestExecution from "../pages/TestExecution";
import RunDetail from "../pages/RunDetail";
import ApiTesting from "../pages/ApiTesting";
import BugReports from "../pages/BugReports";
import BugDetailPage from "../pages/BugDetailPage";
import AIAnalysis from "../pages/AIAnalysis";
import NotFound from "../pages/NotFound";
import EmptyState from "../components/ui/EmptyState";
import Reports from "../pages/Reports";
import Analytics from "../pages/Analytics";
import Team from "../pages/Team";
import Integrations from "../pages/Integrations";
import { NAV_ITEMS } from "../utils/constants";

function ComingSoon({ title, phase }) {
  return (
    <div className="mx-auto max-w-2xl pt-10">
      <EmptyState
        icon={Hammer}
        title={`${title} is coming soon`}
        description={`This page is built in Phase ${phase}.`}
      />
    </div>
  );
}

const REAL_PAGES = [
  "/",
  "/settings",
  "/projects",
  "/test-cases",
  "/execution",
  "/api-testing",
  "/bugs",
  "/ai-analysis",
  "/reports",
  "/analytics",
  "/team",
  "/integrations",
];

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="settings" element={<Settings />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:projectId" element={<ProjectDetail />} />
          <Route path="test-cases" element={<TestCases />} />
          <Route path="execution" element={<TestExecution />} />
          <Route path="execution/:runId" element={<RunDetail />} />
          <Route path="api-testing" element={<ApiTesting />} />
          <Route path="bugs" element={<BugReports />} />
          <Route path="bugs/:bugId" element={<BugDetailPage />} />
          <Route path="ai-analysis" element={<AIAnalysis />} />
          <Route path="reports" element={<Reports />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="team" element={<Team />} />
          <Route path="integrations" element={<Integrations />} />
          {NAV_ITEMS.filter((n) => !REAL_PAGES.includes(n.path)).map((n) => (
            <Route
              key={n.path}
              path={n.path.slice(1)}
              element={<ComingSoon title={n.label} phase={n.phase} />}
            />
          ))}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  );
}
