import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CertificationsPage } from "./CertificationsPage";

const { listCertifications } = vi.hoisted(() => ({ listCertifications: vi.fn() }));
vi.mock("../lib/api", () => ({ listCertifications }));

describe("CertificationsPage", () => {
  it("renders the seeded tiers with their key stats", async () => {
    listCertifications.mockResolvedValue([
      {
        code: "AFA",
        title: "AI Foundations Associate",
        required_levels: "00-02",
        written_questions: 60,
        practical: "Structured prompt and evaluation",
        passing_percent: 80,
        recert_months: 12,
      },
    ]);

    render(
      <MemoryRouter>
        <CertificationsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText(/AFA.*AI Foundations Associate/)).toBeInTheDocument();
    expect(screen.getByText(/Levels 00-02/)).toBeInTheDocument();
    expect(screen.getByText(/Passing score 80%/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /AFA/ })).toHaveAttribute("href", "/certifications/AFA");
  });
});
