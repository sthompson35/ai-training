import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { KnowledgeBasePage } from "./KnowledgeBasePage";
import { ToastProvider } from "../components/ToastProvider";

const { listKBArticles } = vi.hoisted(() => ({ listKBArticles: vi.fn() }));
vi.mock("../lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/api")>();
  return { ...actual, listKBArticles };
});

const fixtureArticle = {
  id: 1,
  title: "Grounded generation basics",
  domain: "Knowledge Systems and RAG",
  content_type: "definition",
  status: "draft",
  owner: "kb-team",
};

beforeEach(() => {
  listKBArticles.mockReset().mockResolvedValue({ items: [fixtureArticle], total: 1 });
});

describe("KnowledgeBasePage", () => {
  it("renders articles and links to their detail page", async () => {
    render(
      <MemoryRouter>
        <ToastProvider>
          <KnowledgeBasePage />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByRole("link", { name: /Grounded generation basics/ })).toHaveAttribute(
      "href",
      "/knowledge-base/1",
    );
    expect(screen.getByText(/kb-team/)).toBeInTheDocument();
  });

  it("shows an empty state when there are no articles", async () => {
    listKBArticles.mockResolvedValue({ items: [], total: 0 });
    render(
      <MemoryRouter>
        <ToastProvider>
          <KnowledgeBasePage />
        </ToastProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByText(/no articles yet/i)).toBeInTheDocument();
  });

  it("re-queries with domain and status filters", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToastProvider>
          <KnowledgeBasePage />
        </ToastProvider>
      </MemoryRouter>,
    );
    await screen.findByRole("link", { name: /Grounded generation basics/ });

    await user.type(screen.getByLabelText(/domain/i), "RAG");
    await user.selectOptions(screen.getByLabelText(/^status:/i), "approved");

    expect(listKBArticles).toHaveBeenLastCalledWith({
      domain: "RAG",
      status: "approved",
      q: undefined,
      limit: 20,
      offset: 0,
    });
  });

  it("shows pagination controls and paginates with Next", async () => {
    listKBArticles.mockResolvedValue({ items: [fixtureArticle], total: 25 });
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <ToastProvider>
          <KnowledgeBasePage />
        </ToastProvider>
      </MemoryRouter>,
    );

    expect(await screen.findByText(/showing 1–20 of 25/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(listKBArticles).toHaveBeenLastCalledWith({
      domain: undefined,
      status: undefined,
      q: undefined,
      limit: 20,
      offset: 20,
    });
  });
});
