import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { LevelsPage } from "./pages/LevelsPage";
import { LevelDetailPage } from "./pages/LevelDetailPage";
import { LabsPage } from "./pages/LabsPage";
import { CertificationsPage } from "./pages/CertificationsPage";
import { CertificationDetailPage } from "./pages/CertificationDetailPage";
import { LearnersPage } from "./pages/LearnersPage";
import { LearnerDetailPage } from "./pages/LearnerDetailPage";
import { GlossaryPage } from "./pages/GlossaryPage";
import { KnowledgeBasePage } from "./pages/KnowledgeBasePage";
import { KBArticleDetailPage } from "./pages/KBArticleDetailPage";
import { AgentsPage } from "./pages/AgentsPage";
import { AgentDetailPage } from "./pages/AgentDetailPage";
import { ServiceMembersPage } from "./pages/ServiceMembersPage";
import { ServiceMemberDetailPage } from "./pages/ServiceMemberDetailPage";
import { LoginPage } from "./pages/LoginPage";
import { IncidentsPage } from "./pages/IncidentsPage";
import { IncidentDetailPage } from "./pages/IncidentDetailPage";
import { ReleasesPage } from "./pages/ReleasesPage";
import { ReleaseDetailPage } from "./pages/ReleaseDetailPage";
import { GovernancePage } from "./pages/GovernancePage";
import { AuditLogPage } from "./pages/AuditLogPage";
import { UsersPage } from "./pages/UsersPage";
import { PolicyPage } from "./pages/PolicyPage";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "levels", element: <LevelsPage /> },
      { path: "levels/:levelId", element: <LevelDetailPage /> },
      { path: "labs", element: <LabsPage /> },
      { path: "certifications", element: <CertificationsPage /> },
      { path: "certifications/:code", element: <CertificationDetailPage /> },
      { path: "learners", element: <LearnersPage /> },
      { path: "learners/:learnerId", element: <LearnerDetailPage /> },
      { path: "glossary", element: <GlossaryPage /> },
      { path: "knowledge-base", element: <KnowledgeBasePage /> },
      { path: "knowledge-base/new", element: <KBArticleDetailPage /> },
      { path: "knowledge-base/:articleId", element: <KBArticleDetailPage /> },
      { path: "agents", element: <AgentsPage /> },
      { path: "agents/new", element: <AgentDetailPage /> },
      { path: "agents/:agentId", element: <AgentDetailPage /> },
      { path: "service-members", element: <ServiceMembersPage /> },
      { path: "service-members/new", element: <ServiceMemberDetailPage /> },
      { path: "service-members/:serviceMemberId", element: <ServiceMemberDetailPage /> },
      { path: "login", element: <LoginPage /> },
      { path: "incidents", element: <IncidentsPage /> },
      { path: "incidents/new", element: <IncidentDetailPage /> },
      { path: "incidents/:incidentId", element: <IncidentDetailPage /> },
      { path: "releases", element: <ReleasesPage /> },
      { path: "releases/new", element: <ReleaseDetailPage /> },
      { path: "releases/:releaseId", element: <ReleaseDetailPage /> },
      { path: "governance", element: <GovernancePage /> },
      { path: "audit-log", element: <AuditLogPage /> },
      { path: "users", element: <UsersPage /> },
      { path: "policy", element: <PolicyPage /> },
      { path: "change-password", element: <ChangePasswordPage /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
