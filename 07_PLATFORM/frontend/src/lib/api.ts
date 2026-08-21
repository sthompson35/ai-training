export const apiBase: string = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const TOKEN_KEY = "academy_token";
const USERNAME_KEY = "academy_username";
const ROLE_KEY = "academy_role";
export const AUTH_STORAGE_KEYS: string[] = [TOKEN_KEY, USERNAME_KEY, ROLE_KEY];

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const getStoredUsername = (): string | null => localStorage.getItem(USERNAME_KEY);
export const getStoredRole = (): string | null => localStorage.getItem(ROLE_KEY);
export const isAuthenticated = (): boolean => getToken() !== null;

// The native `storage` event only fires in *other* tabs, never the one that
// made the write — so same-tab listeners (e.g. Layout's nav) need this
// custom event dispatched alongside every auth mutation to stay in sync too.
function notifyAuthChanged(): void {
  window.dispatchEvent(new Event("academy-auth-changed"));
}

function setAuth(token: string, username: string, role: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, username);
  localStorage.setItem(ROLE_KEY, role);
  notifyAuthChanged();
}

export function clearAuth(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(ROLE_KEY);
  notifyAuthChanged();
}

export type Module = {
  id: string;
  level_id: string;
  title: string;
  learning_outcome: string;
  estimated_hours: number;
  assessment: string;
};

export type ModuleInput = Omit<Module, "id" | "level_id">;

export type Level = {
  id: string;
  title: string;
};

export type LevelDetail = Level & {
  modules: Module[];
};

export type Lab = {
  id: string;
  title: string;
  domain: string;
  deliverable: string;
};

export type LabInput = Omit<Lab, "id">;

async function extractErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
    if (Array.isArray(body?.detail)) {
      const messages = body.detail
        .map((d: { msg?: string }) => d.msg)
        .filter((m: string | undefined): m is string => Boolean(m));
      if (messages.length > 0) return messages.join(", ");
    }
  } catch {
    // Body wasn't JSON (or was empty) — keep the generic fallback.
  }
  return fallback;
}

async function fetchWithAuth(path: string, init?: RequestInit): Promise<Response> {
  const token = getToken();
  // FormData bodies (file uploads) need the browser to set its own
  // multipart/form-data boundary header — forcing application/json here
  // would break the upload entirely.
  const isFormData = init?.body instanceof FormData;
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (response.status === 401) {
    clearAuth();
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.assign(`/login?reason=expired&next=${next}`);
    throw new Error("Your session expired — please log in again.");
  }
  if (response.status === 429) {
    const retryAfter = response.headers.get("Retry-After");
    throw new Error(
      retryAfter
        ? `Rate limit exceeded — try again in ${retryAfter}s.`
        : "Rate limit exceeded — try again shortly.",
    );
  }
  if (!response.ok) {
    throw new Error(await extractErrorMessage(response, `Request to ${path} failed: ${response.status}`));
  }
  return response;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchWithAuth(path, init);
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export type Paginated<T> = { items: T[]; total: number };

async function requestPaginated<T>(path: string, init?: RequestInit): Promise<Paginated<T>> {
  const response = await fetchWithAuth(path, init);
  const items = (await response.json()) as T[];
  const total = Number(response.headers.get("x-total-count") ?? items.length);
  return { items, total };
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export async function downloadCsv(path: string, filename: string): Promise<void> {
  const response = await fetchWithAuth(path);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export type ImportResult = {
  created: number;
  skipped: { row: number; reason: string }[];
};

export async function importCsv(path: string, file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append("file", file);
  return request<ImportResult>(path, { method: "POST", body: formData });
}

export type BulkDeleteResult = {
  deleted: number;
  skipped: { id: string; reason: string }[];
};

function bulkDelete<T>(path: string, ids: T[]): Promise<BulkDeleteResult> {
  return request<BulkDeleteResult>(path, { method: "POST", body: JSON.stringify({ ids }) });
}

export type BulkUpdateResult = {
  updated: number;
  skipped: { id: string; reason: string }[];
};

function bulkUpdate<T>(path: string, ids: T[], field: string, value: string): Promise<BulkUpdateResult> {
  return request<BulkUpdateResult>(path, { method: "POST", body: JSON.stringify({ ids, [field]: value }) });
}

export type SearchResult = {
  type: string;
  id: string;
  title: string;
  subtitle?: string | null;
  path: string;
};

export async function searchAll(q: string): Promise<SearchResult[]> {
  return request<SearchResult[]>(`/v1/search${buildQuery({ q })}`);
}

export type CountByLabel = { label: string; count: number };

export type CostByDay = { date: string; cost_usd: number };

export type Analytics = {
  modules_by_level: CountByLabel[];
  raci_by_responsibility: CountByLabel[];
  incidents_by_severity: CountByLabel[];
  incidents_by_status: CountByLabel[];
  releases_by_status: CountByLabel[];
  enrollments_by_status: CountByLabel[];
  cost_today_usd: number;
  cost_daily_limit_usd: number;
  cost_remaining_usd: number;
  cost_last_7_days: CostByDay[];
};

export async function getAnalytics(): Promise<Analytics> {
  return request<Analytics>("/v1/analytics");
}

export async function login(username: string, password: string): Promise<void> {
  // Deliberately bypasses request(): a wrong-password 401 here means "show an
  // inline error," not "session expired, redirect to /login" (which is what
  // request()'s shared 401 handling does for every other call).
  const response = await fetch(`${apiBase}/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) {
    if (response.status === 401) throw new Error("Invalid username or password");
    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      throw new Error(
        retryAfter
          ? `Too many login attempts — try again in ${retryAfter}s.`
          : "Too many login attempts — try again shortly.",
      );
    }
    throw new Error(await extractErrorMessage(response, `Login failed: ${response.status}`));
  }
  const body = (await response.json()) as { access_token: string; username: string; role: string };
  setAuth(body.access_token, body.username, body.role);
}

export const listLevels = () => request<Level[]>("/v1/levels");
export const getLevel = (levelId: string) => request<LevelDetail>(`/v1/levels/${levelId}`);
export const exportLevelsCsv = () => downloadCsv("/v1/levels/export", "levels.csv");

export const listModules = () => request<Module[]>("/v1/modules");
export const exportModulesCsv = (levelId?: string) =>
  downloadCsv(`/v1/modules/export${levelId ? `?level_id=${encodeURIComponent(levelId)}` : ""}`, "modules.csv");
export const importModulesCsv = (file: File) => importCsv("/v1/modules/import", file);
export const bulkDeleteModules = (ids: string[]) => bulkDelete("/v1/modules/bulk-delete", ids);

export const createModule = (levelId: string, id: string, payload: ModuleInput) =>
  request<Module>("/v1/modules", {
    method: "POST",
    body: JSON.stringify({ id, level_id: levelId, ...payload }),
  });

export const updateModule = (moduleId: string, payload: ModuleInput) =>
  request<Module>(`/v1/modules/${moduleId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteModule = (moduleId: string) =>
  request<void>(`/v1/modules/${moduleId}`, { method: "DELETE" });

export const listLabs = (domain?: string) =>
  request<Lab[]>(`/v1/labs${domain ? `?domain=${encodeURIComponent(domain)}` : ""}`);
export const exportLabsCsv = (domain?: string) =>
  downloadCsv(`/v1/labs/export${domain ? `?domain=${encodeURIComponent(domain)}` : ""}`, "labs.csv");
export const importLabsCsv = (file: File) => importCsv("/v1/labs/import", file);
export const bulkDeleteLabs = (ids: string[]) => bulkDelete("/v1/labs/bulk-delete", ids);

export const createLab = (id: string, payload: LabInput) =>
  request<Lab>("/v1/labs", {
    method: "POST",
    body: JSON.stringify({ id, ...payload }),
  });

export const updateLab = (labId: string, payload: LabInput) =>
  request<Lab>(`/v1/labs/${labId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteLab = (labId: string) => request<void>(`/v1/labs/${labId}`, { method: "DELETE" });

export type Certification = {
  code: string;
  title: string;
  required_levels: string;
  written_questions: number;
  practical: string;
  passing_percent: number;
  recert_months: number;
};

export type EnrollmentStatus =
  | "enrolled"
  | "written_passed"
  | "practical_submitted"
  | "practical_passed"
  | "board_review"
  | "certified"
  | "failed";

export const ENROLLMENT_STATUSES: EnrollmentStatus[] = [
  "enrolled",
  "written_passed",
  "practical_submitted",
  "practical_passed",
  "board_review",
  "certified",
  "failed",
];

export type Enrollment = {
  id: number;
  learner_id: number;
  certification_code: string;
  status: EnrollmentStatus;
  written_score: number | null;
  notes: string | null;
  enrolled_at: string;
  updated_at: string;
};

export type EnrollmentUpdateInput = {
  status: EnrollmentStatus;
  written_score: number | null;
  notes: string | null;
};

export type CertificationDetail = Certification & { enrollments: Enrollment[] };

export type Learner = {
  id: number;
  name: string;
  email: string;
};

export type LearnerInput = Omit<Learner, "id">;

export type LearnerDetail = Learner & { enrollments: Enrollment[] };

export const listCertifications = () => request<Certification[]>("/v1/certifications");
export const getCertification = (code: string) =>
  request<CertificationDetail>(`/v1/certifications/${code}`);
export const exportCertificationsCsv = () =>
  downloadCsv("/v1/certifications/export", "certifications.csv");

export type ListParams = { q?: string; limit?: number; offset?: number };

export const listLearners = (params: ListParams = {}) =>
  requestPaginated<Learner>(`/v1/learners${buildQuery(params)}`);
export const exportLearnersCsv = (q?: string) =>
  downloadCsv(`/v1/learners/export${buildQuery({ q })}`, "learners.csv");
export const importLearnersCsv = (file: File) => importCsv("/v1/learners/import", file);
export const bulkDeleteLearners = (ids: number[]) => bulkDelete("/v1/learners/bulk-delete", ids);
export const createLearner = (payload: LearnerInput) =>
  request<Learner>("/v1/learners", { method: "POST", body: JSON.stringify(payload) });
export const getLearner = (learnerId: number) => request<LearnerDetail>(`/v1/learners/${learnerId}`);
export const deleteLearner = (learnerId: number) =>
  request<void>(`/v1/learners/${learnerId}`, { method: "DELETE" });

function enrollmentQuery(params: { certificationCode?: string; learnerId?: number }): string {
  const query = new URLSearchParams();
  if (params.certificationCode) query.set("certification_code", params.certificationCode);
  if (params.learnerId) query.set("learner_id", String(params.learnerId));
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

export const listEnrollments = (params: { certificationCode?: string; learnerId?: number } = {}) =>
  request<Enrollment[]>(`/v1/enrollments${enrollmentQuery(params)}`);

export const exportEnrollmentsCsv = (params: { certificationCode?: string; learnerId?: number } = {}) =>
  downloadCsv(`/v1/enrollments/export${enrollmentQuery(params)}`, "enrollments.csv");
export const importEnrollmentsCsv = (file: File) => importCsv("/v1/enrollments/import", file);
export const bulkDeleteEnrollments = (ids: number[]) => bulkDelete("/v1/enrollments/bulk-delete", ids);
export const bulkUpdateEnrollmentStatus = (ids: number[], status: string) =>
  bulkUpdate("/v1/enrollments/bulk-update-status", ids, "status", status);

export const createEnrollment = (learnerId: number, certificationCode: string) =>
  request<Enrollment>("/v1/enrollments", {
    method: "POST",
    body: JSON.stringify({ learner_id: learnerId, certification_code: certificationCode }),
  });

export const updateEnrollment = (enrollmentId: number, payload: EnrollmentUpdateInput) =>
  request<Enrollment>(`/v1/enrollments/${enrollmentId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const deleteEnrollment = (enrollmentId: number) =>
  request<void>(`/v1/enrollments/${enrollmentId}`, { method: "DELETE" });

export type GlossaryTerm = {
  term: string;
  definition: string;
};

export const listGlossary = () => request<GlossaryTerm[]>("/v1/glossary");
export const exportGlossaryCsv = () => downloadCsv("/v1/glossary/export", "glossary.csv");
export const importGlossaryCsv = (file: File) => importCsv("/v1/glossary/import", file);
export const bulkDeleteGlossary = (ids: string[]) => bulkDelete("/v1/glossary/bulk-delete", ids);
export const createGlossaryTerm = (payload: GlossaryTerm) =>
  request<GlossaryTerm>("/v1/glossary", { method: "POST", body: JSON.stringify(payload) });
export const updateGlossaryTerm = (term: string, definition: string) =>
  request<GlossaryTerm>(`/v1/glossary/${encodeURIComponent(term)}`, {
    method: "PUT",
    body: JSON.stringify({ definition }),
  });
export const deleteGlossaryTerm = (term: string) =>
  request<void>(`/v1/glossary/${encodeURIComponent(term)}`, { method: "DELETE" });

export const KB_CONTENT_TYPES = [
  "definition",
  "lesson",
  "lab",
  "SOP",
  "decision_record",
  "evaluation",
  "incident",
  "model_card",
  "tool_card",
] as const;

export const KB_STATUSES = ["draft", "review", "approved", "deprecated", "archived"] as const;

export type KBArticle = {
  id: number;
  title: string;
  domain: string;
  content_type: string;
  status: string;
  owner: string;
  review_date: string;
  version: string;
  definition: string;
  why_it_matters: string;
  when_to_use: string;
  when_not_to_use: string;
  architecture: string;
  inputs_and_outputs: string;
  risks_and_controls: string;
  examples: string;
  evaluation_criteria: string;
  sources: string;
};

export type KBArticleInput = Omit<KBArticle, "id">;

export const listKBArticles = (
  params: { domain?: string; status?: string } & ListParams = {},
) => requestPaginated<KBArticle>(`/v1/kb-articles${buildQuery(params)}`);

export const exportKBArticlesCsv = (params: { domain?: string; status?: string; q?: string } = {}) =>
  downloadCsv(`/v1/kb-articles/export${buildQuery(params)}`, "kb_articles.csv");
export const importKBArticlesCsv = (file: File) => importCsv("/v1/kb-articles/import", file);
export const bulkDeleteKBArticles = (ids: number[]) => bulkDelete("/v1/kb-articles/bulk-delete", ids);
export const bulkUpdateKBArticleStatus = (ids: number[], status: string) =>
  bulkUpdate("/v1/kb-articles/bulk-update-status", ids, "status", status);

export const getKBArticle = (articleId: number) => request<KBArticle>(`/v1/kb-articles/${articleId}`);
export const createKBArticle = (payload: KBArticleInput) =>
  request<KBArticle>("/v1/kb-articles", { method: "POST", body: JSON.stringify(payload) });
export const updateKBArticle = (articleId: number, payload: KBArticleInput) =>
  request<KBArticle>(`/v1/kb-articles/${articleId}`, { method: "PUT", body: JSON.stringify(payload) });
export const deleteKBArticle = (articleId: number) =>
  request<void>(`/v1/kb-articles/${articleId}`, { method: "DELETE" });

export type ApprovalStatus = "draft" | "pending_approval" | "approved" | "suspended" | "retired";

export const APPROVAL_STATUSES: ApprovalStatus[] = [
  "draft",
  "pending_approval",
  "approved",
  "suspended",
  "retired",
];

export type AgentCard = {
  id: number;
  name: string;
  owner: string;
  owner_service_member_id: string | null;
  service_member_id: string | null;
  version: string;
  purpose: string;
  non_goals: string;
  risk_tier: number;
  approved_models: string;
  approved_tools: string;
  data_access: string;
  action_permissions: string;
  approval_requirements: string;
  budgets: string;
  fallback: string;
  monitoring: string;
  kill_switch: string;
  active: boolean;
  approval_status: ApprovalStatus;
  evaluation_set: string;
  last_review: string;
  system_prompt: string | null;
};

export type AgentCardInput = Omit<AgentCard, "id" | "owner_service_member_id">;

export const listAgents = (params: ListParams = {}) =>
  requestPaginated<AgentCard>(`/v1/agents${buildQuery(params)}`);
export const exportAgentsCsv = (q?: string) => downloadCsv(`/v1/agents/export${buildQuery({ q })}`, "agents.csv");
export const importAgentsCsv = (file: File) => importCsv("/v1/agents/import", file);
export const bulkDeleteAgents = (ids: number[]) => bulkDelete("/v1/agents/bulk-delete", ids);
export const getAgent = (agentId: number) => request<AgentCard>(`/v1/agents/${agentId}`);
export const createAgent = (payload: AgentCardInput) =>
  request<AgentCard>("/v1/agents", { method: "POST", body: JSON.stringify(payload) });
export const updateAgent = (agentId: number, payload: AgentCardInput) =>
  request<AgentCard>(`/v1/agents/${agentId}`, { method: "PUT", body: JSON.stringify(payload) });
export const deleteAgent = (agentId: number) =>
  request<void>(`/v1/agents/${agentId}`, { method: "DELETE" });

export type AgentExecuteInput = {
  prompt: string;
  model?: string;
  approval_request_id?: number;
};

export type AgentExecuteResult = {
  status: "completed" | "pending_approval";
  output: string | null;
  model: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  estimated_cost_usd: number;
  approval_request_id: number | null;
  reason: string | null;
};

export const executeAgent = (agentId: number, payload: AgentExecuteInput) =>
  request<AgentExecuteResult>(`/v1/agents/${agentId}/execute`, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export type IncidentSeverity = "low" | "medium" | "high" | "critical";
export type IncidentStatus = "detected" | "contained" | "investigating" | "corrected" | "resolved";
export type CapaStatus = "open" | "in_progress" | "verified" | "closed";

export const INCIDENT_SEVERITIES: IncidentSeverity[] = ["low", "medium", "high", "critical"];
export const INCIDENT_STATUSES: IncidentStatus[] = [
  "detected",
  "contained",
  "investigating",
  "corrected",
  "resolved",
];
export const CAPA_STATUSES: CapaStatus[] = ["open", "in_progress", "verified", "closed"];

export type Incident = {
  id: number;
  title: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  impact: string;
  root_cause: string | null;
  corrective_action: string | null;
  owner: string;
  owner_service_member_id: string | null;
  agent_id: number | null;
  release_id: number | null;
  capa_status: CapaStatus | null;
  opened_at: string;
  resolved_at: string | null;
};

export type IncidentInput = Omit<Incident, "id" | "opened_at" | "owner_service_member_id">;

export const listIncidents = (
  params: { status?: string; severity?: string; agentId?: number; releaseId?: number } & ListParams = {},
) => {
  const { agentId, releaseId, ...rest } = params;
  return requestPaginated<Incident>(
    `/v1/incidents${buildQuery({ ...rest, agent_id: agentId, release_id: releaseId })}`,
  );
};

export const exportIncidentsCsv = (
  params: { status?: string; severity?: string; agentId?: number; releaseId?: number; q?: string } = {},
) => {
  const { agentId, releaseId, ...rest } = params;
  return downloadCsv(
    `/v1/incidents/export${buildQuery({ ...rest, agent_id: agentId, release_id: releaseId })}`,
    "incidents.csv",
  );
};
export const importIncidentsCsv = (file: File) => importCsv("/v1/incidents/import", file);
export const bulkDeleteIncidents = (ids: number[]) => bulkDelete("/v1/incidents/bulk-delete", ids);
export const bulkUpdateIncidentStatus = (ids: number[], status: string) =>
  bulkUpdate("/v1/incidents/bulk-update-status", ids, "status", status);
export const bulkUpdateIncidentCapaStatus = (ids: number[], capaStatus: string) =>
  bulkUpdate("/v1/incidents/bulk-update-capa-status", ids, "capa_status", capaStatus);

export const getIncident = (incidentId: number) => request<Incident>(`/v1/incidents/${incidentId}`);
export const createIncident = (payload: IncidentInput) =>
  request<Incident>("/v1/incidents", { method: "POST", body: JSON.stringify(payload) });
export const updateIncident = (incidentId: number, payload: IncidentInput) =>
  request<Incident>(`/v1/incidents/${incidentId}`, { method: "PUT", body: JSON.stringify(payload) });
export const deleteIncident = (incidentId: number) =>
  request<void>(`/v1/incidents/${incidentId}`, { method: "DELETE" });

export type ReleaseStatus = "proposed" | "approved" | "released" | "rolled_back";

export const RELEASE_STATUSES: ReleaseStatus[] = ["proposed", "approved", "released", "rolled_back"];

export type Release = {
  id: number;
  title: string;
  version: string;
  rationale: string;
  expected_impact: string;
  test_evidence: string;
  approver: string;
  approver_service_member_id: string | null;
  risk_tier: number;
  release_date: string;
  rollback_target: string;
  status: ReleaseStatus;
};

export type ReleaseInput = Omit<Release, "id" | "approver_service_member_id">;

export const listReleases = (params: { status?: string } & ListParams = {}) =>
  requestPaginated<Release>(`/v1/releases${buildQuery(params)}`);

export const exportReleasesCsv = (params: { status?: string; q?: string } = {}) =>
  downloadCsv(`/v1/releases/export${buildQuery(params)}`, "releases.csv");
export const importReleasesCsv = (file: File) => importCsv("/v1/releases/import", file);
export const bulkDeleteReleases = (ids: number[]) => bulkDelete("/v1/releases/bulk-delete", ids);
export const bulkUpdateReleaseStatus = (ids: number[], status: string) =>
  bulkUpdate("/v1/releases/bulk-update-status", ids, "status", status);

export const getRelease = (releaseId: number) => request<Release>(`/v1/releases/${releaseId}`);
export const createRelease = (payload: ReleaseInput) =>
  request<Release>("/v1/releases", { method: "POST", body: JSON.stringify(payload) });
export const updateRelease = (releaseId: number, payload: ReleaseInput) =>
  request<Release>(`/v1/releases/${releaseId}`, { method: "PUT", body: JSON.stringify(payload) });
export const deleteRelease = (releaseId: number) =>
  request<void>(`/v1/releases/${releaseId}`, { method: "DELETE" });

export type RaciEntry = {
  id: number;
  activity: string;
  role: string;
  responsibility: string;
};

export type RaciEntryInput = Omit<RaciEntry, "id">;

export const listRaciEntries = (activity?: string) =>
  request<RaciEntry[]>(`/v1/governance/raci${activity ? `?activity=${encodeURIComponent(activity)}` : ""}`);
export const exportRaciEntriesCsv = (activity?: string) =>
  downloadCsv(
    `/v1/governance/raci/export${activity ? `?activity=${encodeURIComponent(activity)}` : ""}`,
    "governance_raci.csv",
  );
export const importRaciEntriesCsv = (file: File) => importCsv("/v1/governance/raci/import", file);
export const bulkDeleteRaciEntries = (ids: number[]) => bulkDelete("/v1/governance/raci/bulk-delete", ids);

export const createRaciEntry = (payload: RaciEntryInput) =>
  request<RaciEntry>("/v1/governance/raci", { method: "POST", body: JSON.stringify(payload) });
export const updateRaciEntry = (entryId: number, payload: RaciEntryInput) =>
  request<RaciEntry>(`/v1/governance/raci/${entryId}`, { method: "PUT", body: JSON.stringify(payload) });
export const deleteRaciEntry = (entryId: number) =>
  request<void>(`/v1/governance/raci/${entryId}`, { method: "DELETE" });

export type AuditLogEntry = {
  id: number;
  timestamp: string;
  username: string;
  service_member_id: string | null;
  method: string;
  path: string;
  status_code: number;
};

export const listAuditLog = (params: { username?: string; serviceMemberId?: string } & ListParams = {}) => {
  const { serviceMemberId, ...rest } = params;
  return requestPaginated<AuditLogEntry>(
    `/v1/audit-log${buildQuery({ ...rest, service_member_id: serviceMemberId })}`,
  );
};

export const exportAuditLogCsv = (params: { username?: string; q?: string } = {}) =>
  downloadCsv(`/v1/audit-log/export${buildQuery(params)}`, "audit_log.csv");

export type UserRole = "admin" | "contributor";

export const USER_ROLES: UserRole[] = ["admin", "contributor"];

export type User = {
  id: number;
  username: string;
  role: UserRole;
  service_member_id: string | null;
  created_at: string;
};

export type UserInput = {
  username: string;
  password: string;
  role: UserRole;
  identifier?: string;
};

export const listUsers = () => request<User[]>("/v1/users");
export const exportUsersCsv = () => downloadCsv("/v1/users/export", "users.csv");
export const importUsersCsv = (file: File) => importCsv("/v1/users/import", file);
export const bulkDeleteUsers = (ids: number[]) => bulkDelete("/v1/users/bulk-delete", ids);
export const bulkUpdateUserRole = (ids: number[], role: string) =>
  bulkUpdate("/v1/users/bulk-update-role", ids, "role", role);
export const createUser = (payload: UserInput) =>
  request<User>("/v1/users", { method: "POST", body: JSON.stringify(payload) });
export const updateUserRole = (userId: number, role: UserRole) =>
  request<User>(`/v1/users/${userId}`, { method: "PUT", body: JSON.stringify({ role }) });
export const deleteUser = (userId: number) =>
  request<void>(`/v1/users/${userId}`, { method: "DELETE" });

export const changeMyPassword = (currentPassword: string, newPassword: string) =>
  request<void>("/v1/users/me/password", {
    method: "PUT",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });

export const resetUserPassword = (userId: number, newPassword: string) =>
  request<void>(`/v1/users/${userId}/password`, {
    method: "PUT",
    body: JSON.stringify({ new_password: newPassword }),
  });

export const linkUserIdentity = (userId: number, identifier: string) =>
  request<User>(`/v1/users/${userId}/identity`, {
    method: "PUT",
    body: JSON.stringify({ identifier }),
  });

export type ApprovalRequestStatus = "pending" | "approved" | "rejected";

export type ApprovalRequest = {
  id: number;
  task_type: string;
  route: string;
  risk_tier: number;
  input_chars: number;
  reason: string;
  status: ApprovalRequestStatus;
  requested_at: string;
  decided_at: string | null;
  decided_by: string | null;
  decided_by_service_member_id: string | null;
  decision_note: string | null;
};

export type PolicyConfig = { approval_tier: number; cost_per_1k_chars_usd: number };

export const listApprovals = (params: { status?: string } & ListParams = {}) =>
  requestPaginated<ApprovalRequest>(`/v1/policy/approvals${buildQuery(params)}`);
export const getApproval = (id: number) => request<ApprovalRequest>(`/v1/policy/approvals/${id}`);
export const approveApproval = (id: number, note?: string) =>
  request<ApprovalRequest>(`/v1/policy/approvals/${id}/approve`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
export const rejectApproval = (id: number, note?: string) =>
  request<ApprovalRequest>(`/v1/policy/approvals/${id}/reject`, {
    method: "POST",
    body: JSON.stringify({ note }),
  });
export const getPolicyConfig = () => request<PolicyConfig>("/v1/policy/config");

export type MemberClass = "human_trooper" | "ai_agent";

export const MEMBER_CLASSES: MemberClass[] = ["human_trooper", "ai_agent"];

// Free text (backend enforces only min/max length): the canonical R2 roster's
// command_layer values are actual department names (e.g. "Technology Command",
// "Academy Growth Operations"), not a fixed enum. This list is suggestions for
// a <datalist>, not an exhaustive/enforced set.
export type CommandLayer = string;

export const COMMAND_LAYERS: CommandLayer[] = [
  "Academy Business Services",
  "Academy Support Operations",
  "Academy Growth Operations",
  "Academy Sales Operations",
  "Academy Social Operations",
  "Academy Writing Operations",
  "Academy People Operations",
  "Academy Program Management",
  "Strategic Command",
  "Executive Command",
  "AI Command",
  "Operations Command",
  "Independent Assurance",
  "Knowledge Command",
  "Academy Command",
  "Real Estate Operations",
  "Capital Operations",
  "Legal & Compliance",
  "Finance & Governance",
  "Technology Command",
  "Data Command",
  "Automation Command",
  "Security Command",
  "Telemetry & Analytics",
  "Web3 Command",
  "Brand Command",
  "Growth Command",
  "Commerce Command",
  "Creative Command",
  "Media Command",
  "Logistics Command",
  "Recon Command",
  "Continuity & R&D",
];

export type LifecycleState = "active" | "inactive" | "discharged";

export const LIFECYCLE_STATES: LifecycleState[] = ["active", "inactive", "discharged"];

export type ReadinessState = "ready" | "not_ready" | "in_training" | "stand_down";

export const READINESS_STATES: ReadinessState[] = ["ready", "not_ready", "in_training", "stand_down"];

export type ProductionVerificationState = "unverified" | "verified" | "revoked";

export const PRODUCTION_VERIFICATION_STATES: ProductionVerificationState[] = [
  "unverified",
  "verified",
  "revoked",
];

export type ServiceMember = {
  service_member_id: string;
  callsign_id: string;
  callsign: string;
  display_name: string;
  member_class: MemberClass;
  command_layer: CommandLayer;
  current_role: string;
  role_version: number;
  lifecycle_state: LifecycleState;
  readiness_state: ReadinessState;
  production_verification_state: ProductionVerificationState;
  created_by_service_member_id: string | null;
  legacy_alias: string | null;
  source_lineage: string | null;
  created_at: string;
  updated_at: string;
};

// Create-only: the identity fields (service_member_id/callsign_id/callsign) are
// immutable after creation, so ServiceMemberUpdateInput (below) omits them.
export type ServiceMemberInput = {
  service_member_id: string;
  callsign_id: string;
  callsign: string;
  display_name: string;
  member_class: MemberClass;
  command_layer: CommandLayer;
  current_role: string;
  lifecycle_state: LifecycleState;
  readiness_state: ReadinessState;
  production_verification_state: ProductionVerificationState;
  legacy_alias: string | null;
  source_lineage: string | null;
};

export type ServiceMemberUpdateInput = {
  display_name: string;
  readiness_state: ReadinessState;
  legacy_alias: string | null;
};

export type LifecycleTransitionInput = {
  reason: string;
};

export type LifecycleTransitionHistoryEntry = {
  id: number;
  service_member_id: string;
  from_state: string;
  to_state: string;
  reason: string;
  changed_by: string | null;
  effective_at: string;
};

export type RoleAssignmentHistoryEntry = {
  id: number;
  service_member_id: string;
  role_version: number;
  role: string;
  command_layer: string;
  readiness_state: string;
  effective_at: string;
  changed_by: string | null;
  change_reason: string | null;
};

export type RoleChangeInput = {
  new_role: string;
  new_command_layer: CommandLayer;
  reason?: string;
};

export type VerificationOutcome = "verified" | "rejected" | "revoked";

export const VERIFICATION_OUTCOMES: VerificationOutcome[] = ["verified", "rejected", "revoked"];

export type IdentityVerification = {
  id: number;
  service_member_id: string;
  evidence_reference: string;
  verification_method: string;
  outcome: VerificationOutcome;
  verifier_service_member_id: string;
  notes: string | null;
  verified_at: string;
};

export type VerifyIdentityInput = {
  evidence_reference: string;
  verification_method: string;
  outcome: VerificationOutcome;
  notes?: string;
};

export const listServiceMembers = (
  params: { memberClass?: string; lifecycleState?: string } & ListParams = {},
) => {
  const { memberClass, lifecycleState, ...rest } = params;
  return requestPaginated<ServiceMember>(
    `/v1/service-members${buildQuery({ ...rest, member_class: memberClass, lifecycle_state: lifecycleState })}`,
  );
};

export const exportServiceMembersCsv = (
  params: { memberClass?: string; lifecycleState?: string; q?: string } = {},
) => {
  const { memberClass, lifecycleState, ...rest } = params;
  return downloadCsv(
    `/v1/service-members/export${buildQuery({ ...rest, member_class: memberClass, lifecycle_state: lifecycleState })}`,
    "service_members.csv",
  );
};

export const importServiceMembersCsv = (file: File) => importCsv("/v1/service-members/import", file);

export const resolveServiceMember = (identifier: string) =>
  request<ServiceMember>(`/v1/service-members/resolve${buildQuery({ identifier })}`);

export const getServiceMember = (serviceMemberId: string) =>
  request<ServiceMember>(`/v1/service-members/${encodeURIComponent(serviceMemberId)}`);

export const getRoleHistory = (serviceMemberId: string) =>
  request<RoleAssignmentHistoryEntry[]>(
    `/v1/service-members/${encodeURIComponent(serviceMemberId)}/role-history`,
  );

export const createServiceMember = (payload: ServiceMemberInput) =>
  request<ServiceMember>("/v1/service-members", { method: "POST", body: JSON.stringify(payload) });

export const updateServiceMember = (serviceMemberId: string, payload: ServiceMemberUpdateInput) =>
  request<ServiceMember>(`/v1/service-members/${encodeURIComponent(serviceMemberId)}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

export const changeServiceMemberRole = (serviceMemberId: string, payload: RoleChangeInput) =>
  request<RoleAssignmentHistoryEntry>(
    `/v1/service-members/${encodeURIComponent(serviceMemberId)}/role-change`,
    { method: "POST", body: JSON.stringify(payload) },
  );

export const verifyIdentity = (serviceMemberId: string, payload: VerifyIdentityInput) =>
  request<IdentityVerification>(
    `/v1/service-members/${encodeURIComponent(serviceMemberId)}/verify`,
    { method: "POST", body: JSON.stringify(payload) },
  );

export const getVerifications = (serviceMemberId: string) =>
  request<IdentityVerification[]>(
    `/v1/service-members/${encodeURIComponent(serviceMemberId)}/verifications`,
  );

export const deactivateServiceMember = (serviceMemberId: string, payload: LifecycleTransitionInput) =>
  request<LifecycleTransitionHistoryEntry>(
    `/v1/service-members/${encodeURIComponent(serviceMemberId)}/deactivate`,
    { method: "POST", body: JSON.stringify(payload) },
  );

export const reactivateServiceMember = (serviceMemberId: string, payload: LifecycleTransitionInput) =>
  request<LifecycleTransitionHistoryEntry>(
    `/v1/service-members/${encodeURIComponent(serviceMemberId)}/reactivate`,
    { method: "POST", body: JSON.stringify(payload) },
  );

export const dischargeServiceMember = (serviceMemberId: string, payload: LifecycleTransitionInput) =>
  request<LifecycleTransitionHistoryEntry>(
    `/v1/service-members/${encodeURIComponent(serviceMemberId)}/discharge`,
    { method: "POST", body: JSON.stringify(payload) },
  );

export const getLifecycleHistory = (serviceMemberId: string) =>
  request<LifecycleTransitionHistoryEntry[]>(
    `/v1/service-members/${encodeURIComponent(serviceMemberId)}/lifecycle-history`,
  );
