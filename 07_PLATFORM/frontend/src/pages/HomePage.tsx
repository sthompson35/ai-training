import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Analytics,
  AuditLogEntry,
  apiBase,
  getAnalytics,
  getStoredRole,
  isAuthenticated,
  listAgents,
  listAuditLog,
  listCertifications,
  listEnrollments,
  listGlossary,
  listIncidents,
  listKBArticles,
  listLabs,
  listLearners,
  listLevels,
  listModules,
  listRaciEntries,
  listReleases,
} from "../lib/api";
import { BarChart } from "../components/BarChart";

type RouteResult = {
  route: "client" | "server" | "unavailable" | "pending_approval";
  reason: string;
  degraded_mode: boolean;
  requires_human_approval: boolean;
  policy_version: string;
  estimated_cost_usd?: number;
  approval_request_id?: number | null;
};

type Stats = {
  levels?: number;
  modules?: number;
  labs?: number;
  certifications?: number;
  learners?: number;
  enrollments?: number;
  glossaryTerms?: number;
  kbArticles?: number;
  agents?: number;
  incidents?: number;
  releases?: number;
  raciEntries?: number;
};

type DashboardTileProps = {
  to: string;
  title: string;
  children: React.ReactNode;
};

function DashboardTile({ to, title, children }: DashboardTileProps): React.ReactElement {
  return (
    <Link to={to} style={{ textDecoration: "none", color: "inherit" }}>
      <div style={{ border: "1px solid var(--color-border-subtle)", borderRadius: 8, padding: 16, height: "100%" }}>
        <h3 style={{ margin: "0 0 8px" }}>{title}</h3>
        <p style={{ margin: 0 }}>{children}</p>
      </div>
    </Link>
  );
}

export function HomePage(): React.ReactElement {
  const [stats, setStats] = useState<Stats>({});
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [recentActivity, setRecentActivity] = useState<AuditLogEntry[] | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  const [result, setResult] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [riskTier, setRiskTier] = useState(1);

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      listLevels().then((items) => ["levels", items.length] as const),
      listModules().then((items) => ["modules", items.length] as const),
      listLabs().then((items) => ["labs", items.length] as const),
      listCertifications().then((items) => ["certifications", items.length] as const),
      listLearners({ limit: 1 }).then(({ total }) => ["learners", total] as const),
      listEnrollments().then((items) => ["enrollments", items.length] as const),
      listGlossary().then((items) => ["glossaryTerms", items.length] as const),
      listKBArticles({ limit: 1 }).then(({ total }) => ["kbArticles", total] as const),
      listAgents({ limit: 1 }).then(({ total }) => ["agents", total] as const),
      listIncidents({ limit: 1 }).then(({ total }) => ["incidents", total] as const),
      listReleases({ limit: 1 }).then(({ total }) => ["releases", total] as const),
      listRaciEntries().then((items) => ["raciEntries", items.length] as const),
    ]).then((results) => {
      if (cancelled) return;
      const next: Record<string, number> = {};
      for (const outcome of results) {
        if (outcome.status === "fulfilled") {
          const [key, value] = outcome.value;
          next[key] = value;
        }
      }
      setStats(next as Stats);
      setStatsLoaded(true);
    });

    if (isAuthenticated()) {
      listAuditLog({ limit: 5 })
        .then(({ items }) => {
          if (!cancelled) setRecentActivity(items);
        })
        .catch(() => {
          if (!cancelled) setRecentActivity([]);
        });
    }

    getAnalytics()
      .then((data) => {
        if (!cancelled) setAnalytics(data);
      })
      .catch(() => {
        if (!cancelled) setAnalytics(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function testRoute(): Promise<void> {
    setLoading(true);
    try {
      const response = await fetch(`${apiBase}/v1/route`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task_type: "summarization",
          input_chars: 1800,
          requires_current_data: false,
          contains_sensitive_data: true,
          network_quality: navigator.onLine ? "good" : "offline",
          client_ai_available: "LanguageModel" in globalThis,
          risk_tier: riskTier,
        }),
      });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      setResult((await response.json()) as RouteResult);
    } catch (error) {
      setResult({
        route: "unavailable",
        reason: error instanceof Error ? error.message : "Unknown error",
        degraded_mode: true,
        requires_human_approval: false,
        policy_version: "unknown",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1>AI Training Academy</h1>
      <p>Institutional operations console for hybrid AI training and governance.</p>

      {!statsLoaded ? (
        <p>Loading dashboard…</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            marginBottom: 24,
          }}
        >
          <DashboardTile to="/levels" title="Curriculum">
            {stats.levels ?? "–"} levels · {stats.modules ?? "–"} modules · {stats.labs ?? "–"} labs
          </DashboardTile>
          <DashboardTile to="/learners" title="Certification">
            {stats.certifications ?? "–"} tiers · {stats.learners ?? "–"} learners ·{" "}
            {stats.enrollments ?? "–"} enrollments
          </DashboardTile>
          <DashboardTile to="/knowledge-base" title="Knowledge Base">
            {stats.glossaryTerms ?? "–"} glossary terms · {stats.kbArticles ?? "–"} articles
          </DashboardTile>
          <DashboardTile to="/agents" title="Agents">
            {stats.agents ?? "–"} registered
          </DashboardTile>
          <DashboardTile to="/incidents" title="Incidents">
            {stats.incidents ?? "–"} logged
          </DashboardTile>
          <DashboardTile to="/releases" title="Releases">
            {stats.releases ?? "–"} logged
          </DashboardTile>
          <DashboardTile to="/governance" title="Governance">
            {stats.raciEntries ?? "–"} RACI entries
          </DashboardTile>
        </div>
      )}

      {recentActivity && recentActivity.length > 0 && (
        <section style={{ marginBottom: 24 }}>
          <h2>Recent Activity</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {recentActivity.map((entry) => (
              <li key={entry.id} style={{ borderBottom: "1px solid var(--color-border-faint)", padding: "4px 0" }}>
                {new Date(entry.timestamp).toLocaleString()} — {entry.username} {entry.method}{" "}
                {entry.path} ({entry.status_code})
              </li>
            ))}
          </ul>
          <Link to="/audit-log">View full audit log →</Link>
        </section>
      )}

      {analytics && (
        <section style={{ marginBottom: 24 }}>
          <h2>Analytics</h2>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 24,
            }}
          >
            <BarChart title="Modules by level" data={analytics.modules_by_level} />
            <BarChart title="Governance RACI by responsibility" data={analytics.raci_by_responsibility} />
            <BarChart title="Incidents by severity" data={analytics.incidents_by_severity} />
            <BarChart title="Incidents by status" data={analytics.incidents_by_status} />
            <BarChart title="Releases by status" data={analytics.releases_by_status} />
            <BarChart title="Enrollments by status" data={analytics.enrollments_by_status} />
          </div>

          <h3 style={{ marginTop: 24 }}>Cost</h3>
          <p>
            Today: ${analytics.cost_today_usd.toFixed(2)} spent of ${analytics.cost_daily_limit_usd.toFixed(2)}{" "}
            daily limit (${analytics.cost_remaining_usd.toFixed(2)} remaining)
          </p>
          <div style={{ maxWidth: 420 }}>
            <BarChart
              title="Cost by day, USD (last 7 days)"
              data={analytics.cost_last_7_days.map((d) => ({ label: d.date, count: d.cost_usd }))}
            />
          </div>
        </section>
      )}

      <section style={{ border: "1px solid var(--color-border)", borderRadius: 12, padding: 20 }}>
        <h2>Hybrid Route Diagnostic</h2>
        <p>
          This diagnostic sends task, privacy, network, and client-capability signals
          to the reference routing policy.
        </p>
        <label style={{ marginRight: 12 }}>
          Risk tier:{" "}
          <select value={riskTier} onChange={(e) => setRiskTier(Number(e.target.value))}>
            {[0, 1, 2, 3, 4].map((tier) => (
              <option key={tier} value={tier}>
                {tier}
              </option>
            ))}
          </select>
        </label>
        <button onClick={testRoute} disabled={loading}>
          {loading ? "Evaluating…" : "Evaluate Route"}
        </button>

        {result && result.route === "pending_approval" && (
          <p style={{ marginTop: 20 }}>
            This request requires human approval (request #{result.approval_request_id}).
            {getStoredRole() === "admin" && (
              <>
                {" "}
                <Link to="/policy">Review it on the Policy page →</Link>
              </>
            )}
          </p>
        )}

        {result && (
          <pre style={{ marginTop: 20, whiteSpace: "pre-wrap" }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </section>
    </>
  );
}
