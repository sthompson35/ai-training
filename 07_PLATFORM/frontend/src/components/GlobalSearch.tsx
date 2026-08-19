import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { searchAll, type SearchResult } from "../lib/api";

const TYPE_LABELS: Record<string, string> = {
  level: "Curriculum Levels",
  module: "Modules",
  lab: "Labs",
  certification: "Certifications",
  learner: "Learners",
  glossary: "Glossary",
  kb_article: "Knowledge Base",
  agent: "Agents",
  incident: "Incidents",
  release: "Releases",
  raci: "Governance",
};

const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

export function GlobalSearch(): React.ReactElement {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    setActiveIndex(-1);
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearched(false);
      setOpen(false);
      return;
    }
    const timer = setTimeout(() => {
      searchAll(trimmed).then((found) => {
        setResults(found);
        setSearched(true);
        setOpen(true);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  function handleSelect(result: SearchResult): void {
    setQuery("");
    setResults([]);
    setSearched(false);
    setOpen(false);
    setActiveIndex(-1);
    navigate(result.path);
  }

  const grouped = results.reduce<Record<string, SearchResult[]>>((acc, result) => {
    (acc[result.type] ??= []).push(result);
    return acc;
  }, {});
  const flatResults = Object.values(grouped).flat();

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    } else if (event.key === "ArrowDown" && flatResults.length > 0) {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (event.key === "ArrowUp" && flatResults.length > 0) {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === "Enter" && activeIndex >= 0 && flatResults[activeIndex]) {
      event.preventDefault();
      handleSelect(flatResults[activeIndex]);
    }
  }

  function resultId(result: SearchResult): string {
    return `search-result-${result.type}-${result.id}`;
  }

  return (
    <div style={{ position: "relative" }}>
      <input
        ref={inputRef}
        type="search"
        placeholder={`Search everything… (${isMac ? "⌘K" : "Ctrl+K"})`}
        aria-label="Search"
        aria-activedescendant={activeIndex >= 0 && flatResults[activeIndex] ? resultId(flatResults[activeIndex]) : undefined}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => query.trim().length >= MIN_QUERY_LENGTH && setOpen(true)}
        onKeyDown={handleKeyDown}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        style={{ padding: "6px 10px", width: 220 }}
      />
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "var(--color-bg)",
            border: "1px solid var(--color-border)",
            borderRadius: 4,
            marginTop: 4,
            maxHeight: 360,
            overflowY: "auto",
            zIndex: 20,
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          {results.length === 0 && searched && (
            <div style={{ padding: "8px 12px", color: "var(--color-text-subtle)" }}>No results</div>
          )}
          {Object.entries(grouped).map(([type, items]) => (
            <div key={type}>
              <div
                style={{
                  padding: "4px 12px",
                  fontSize: 12,
                  fontWeight: "bold",
                  color: "var(--color-text-subtle)",
                  background: "var(--color-bg-muted)",
                }}
              >
                {TYPE_LABELS[type] ?? type}
              </div>
              {items.map((item) => (
                <button
                  key={`${item.type}-${item.id}`}
                  id={resultId(item)}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    handleSelect(item);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "6px 12px",
                    border: "none",
                    background:
                      flatResults[activeIndex] === item ? "var(--color-bg-muted)" : "none",
                    cursor: "pointer",
                  }}
                >
                  <div>{item.title}</div>
                  {item.subtitle && <div style={{ fontSize: 12, color: "var(--color-text-subtle)" }}>{item.subtitle}</div>}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
