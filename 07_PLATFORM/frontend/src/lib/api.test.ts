import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { downloadCsv, deleteLearner } from "./api";

describe("downloadCsv", () => {
  let clickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        blob: async () => new Blob(["id,title\n1,Example\n"], { type: "text/csv" }),
      } as unknown as Response),
    );

    URL.createObjectURL = vi.fn().mockReturnValue("blob:mock-url");
    URL.revokeObjectURL = vi.fn();

    clickSpy = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = originalCreateElement(tag);
      if (tag === "a") (el as HTMLAnchorElement).click = clickSpy;
      return el;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("fetches the export path and triggers a download with the given filename", async () => {
    await downloadCsv("/v1/incidents/export?status=high", "incidents.csv");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/incidents/export?status=high"),
      expect.any(Object),
    );
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});

describe("error messages", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("surfaces the backend's string detail message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        headers: new Headers(),
        json: async () => ({ detail: "A learner with this email already exists" }),
      } as unknown as Response),
    );

    await expect(deleteLearner(1)).rejects.toThrow("A learner with this email already exists");
  });

  it("joins FastAPI's list-shaped validation detail into a message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 422,
        headers: new Headers(),
        json: async () => ({ detail: [{ loc: ["body", "email"], msg: "field required", type: "missing" }] }),
      } as unknown as Response),
    );

    await expect(deleteLearner(1)).rejects.toThrow("field required");
  });

  it("falls back to a generic message when the body isn't JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: async () => {
          throw new SyntaxError("Unexpected end of input");
        },
      } as unknown as Response),
    );

    await expect(deleteLearner(1)).rejects.toThrow("Request to /v1/learners/1 failed: 500");
  });
});

describe("session expiry", () => {
  const originalLocation = window.location;

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    Object.defineProperty(window, "location", { writable: true, configurable: true, value: originalLocation });
  });

  it("redirects to /login with the reason and current path on a 401", async () => {
    window.history.pushState({}, "", "/incidents/42?tab=notes");
    const assignMock = vi.fn();
    Object.defineProperty(window, "location", {
      writable: true,
      configurable: true,
      value: { ...originalLocation, assign: assignMock },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        headers: new Headers(),
        json: async () => ({ detail: "Invalid or expired token" }),
      } as unknown as Response),
    );

    await expect(deleteLearner(1)).rejects.toThrow("Your session expired — please log in again.");

    expect(assignMock).toHaveBeenCalledWith(
      `/login?reason=expired&next=${encodeURIComponent("/incidents/42?tab=notes")}`,
    );
  });
});
