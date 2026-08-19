import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  KB_STATUSES,
  KBArticle,
  bulkDeleteKBArticles,
  bulkUpdateKBArticleStatus,
  exportKBArticlesCsv,
  importKBArticlesCsv,
  listKBArticles,
} from "../lib/api";
import { Pagination } from "../components/Pagination";
import { ImportCsvButton } from "../components/ImportCsvButton";
import { BulkDeleteButton } from "../components/BulkDeleteButton";
import { BulkEditButton } from "../components/BulkEditButton";
import { useSelection } from "../hooks/useSelection";
import { useFocusHeadingOnMount } from "../hooks/useFocusHeadingOnMount";

const STATUS_OPTIONS = KB_STATUSES.map((status) => ({ value: status, label: status }));

const LIMIT = 20;

export function KnowledgeBasePage(): React.ReactElement {
  const headingRef = useFocusHeadingOnMount<HTMLHeadingElement>();
  const [articles, setArticles] = useState<KBArticle[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [query, setQuery] = useState("");
  const [offset, setOffset] = useState(0);
  const selection = useSelection<number>();

  function refresh(): void {
    listKBArticles({
      domain: domainFilter || undefined,
      status: statusFilter || undefined,
      q: query || undefined,
      limit: LIMIT,
      offset,
    })
      .then(({ items, total }) => {
        setArticles(items);
        setTotal(total);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load articles"));
  }

  useEffect(refresh, [domainFilter, statusFilter, query, offset]);

  function updateFilter(setter: (value: string) => void, value: string): void {
    setter(value);
    setOffset(0);
  }

  return (
    <>
      <h1 ref={headingRef} tabIndex={-1}>Knowledge Base</h1>
      <div style={{ marginBottom: 16 }}>
        <label>
          Search title:{" "}
          <input value={query} onChange={(e) => updateFilter(setQuery, e.target.value)} />
        </label>
        <label style={{ marginLeft: 16 }}>
          Domain:{" "}
          <input
            value={domainFilter}
            onChange={(e) => updateFilter(setDomainFilter, e.target.value)}
          />
        </label>
        <label style={{ marginLeft: 16 }}>
          Status:{" "}
          <select value={statusFilter} onChange={(e) => updateFilter(setStatusFilter, e.target.value)}>
            <option value="">All</option>
            {KB_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() =>
            exportKBArticlesCsv({
              domain: domainFilter || undefined,
              status: statusFilter || undefined,
              q: query || undefined,
            })
          }
          style={{ marginLeft: 16 }}
        >
          Export CSV
        </button>
        <ImportCsvButton onImport={importKBArticlesCsv} onComplete={refresh} />
        <BulkDeleteButton
          selectedIds={[...selection.selected]}
          onBulkDelete={bulkDeleteKBArticles}
          onComplete={() => {
            selection.clear();
            refresh();
          }}
        />
        <BulkEditButton
          selectedIds={[...selection.selected]}
          options={STATUS_OPTIONS}
          fieldLabel="status"
          onBulkUpdate={bulkUpdateKBArticleStatus}
          onComplete={() => {
            selection.clear();
            refresh();
          }}
        />
      </div>

      {error && <p role="alert">{error}</p>}
      {!articles ? (
        <p>Loading articles…</p>
      ) : articles.length === 0 ? (
        <p>No articles yet.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {articles.map((article) => (
            <li
              key={article.id}
              style={{ border: "1px solid var(--color-border-subtle)", borderRadius: 8, padding: 12, marginBottom: 8 }}
            >
              <input
                type="checkbox"
                aria-label={`Select ${article.title}`}
                checked={selection.isSelected(article.id)}
                onChange={() => selection.toggle(article.id)}
                style={{ marginRight: 8 }}
              />
              <Link to={`/knowledge-base/${article.id}`}>{article.title}</Link>
              <div>
                {article.domain} · {article.content_type} · {article.status} · owner: {article.owner}
              </div>
            </li>
          ))}
        </ul>
      )}
      <Pagination offset={offset} limit={LIMIT} total={total} onOffsetChange={setOffset} />

      <Link to="/knowledge-base/new">
        <button>New Article</button>
      </Link>
    </>
  );
}
