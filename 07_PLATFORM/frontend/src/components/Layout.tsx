import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { clearAuth } from "../lib/api";
import { useAuthState } from "../hooks/useAuthState";
import { GlobalSearch } from "./GlobalSearch";
import { ThemeProvider, useTheme } from "./ThemeProvider";
import { ToastProvider } from "./ToastProvider";

const linkStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
  marginRight: 16,
  fontWeight: isActive ? "bold" : "normal",
  color: isActive ? "var(--color-text)" : "var(--color-text-muted)",
});

function ThemeToggleButton(): React.ReactElement {
  const { theme, toggleTheme } = useTheme();
  return (
    <button onClick={toggleTheme} style={{ marginLeft: 12 }}>
      {theme === "dark" ? "Light mode" : "Dark mode"}
    </button>
  );
}

export function Layout(): React.ReactElement {
  const navigate = useNavigate();
  const auth = useAuthState();

  function handleLogout(): void {
    clearAuth();
    navigate("/");
  }

  return (
    <ThemeProvider>
      <ToastProvider>
        <div style={{ fontFamily: "Arial, sans-serif" }}>
          <header
            style={{
              borderBottom: "1px solid var(--color-border)",
              padding: "16px 24px",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
            }}
          >
            <nav>
              <NavLink to="/" end style={linkStyle}>
                Home
              </NavLink>
              <NavLink to="/levels" style={linkStyle}>
                Curriculum Levels
              </NavLink>
              <NavLink to="/labs" style={linkStyle}>
                Labs
              </NavLink>
              <NavLink to="/certifications" style={linkStyle}>
                Certifications
              </NavLink>
              <NavLink to="/learners" style={linkStyle}>
                Learners
              </NavLink>
              <NavLink to="/glossary" style={linkStyle}>
                Glossary
              </NavLink>
              <NavLink to="/knowledge-base" style={linkStyle}>
                Knowledge Base
              </NavLink>
              <NavLink to="/agents" style={linkStyle}>
                Agents
              </NavLink>
              <NavLink to="/service-members" style={linkStyle}>
                Service Members
              </NavLink>
              <NavLink to="/incidents" style={linkStyle}>
                Incidents
              </NavLink>
              <NavLink to="/releases" style={linkStyle}>
                Releases
              </NavLink>
              <NavLink to="/governance" style={linkStyle}>
                Governance
              </NavLink>
              {auth.isAuthenticated && (
                <NavLink to="/audit-log" style={linkStyle}>
                  Audit Log
                </NavLink>
              )}
              {auth.role === "admin" && (
                <NavLink to="/users" style={linkStyle}>
                  Users
                </NavLink>
              )}
              {auth.role === "admin" && (
                <NavLink to="/policy" style={linkStyle}>
                  Policy
                </NavLink>
              )}
            </nav>
            <GlobalSearch />
            <div style={{ whiteSpace: "nowrap" }}>
              {auth.isAuthenticated ? (
                <span>
                  Logged in as {auth.username} ·{" "}
                  <NavLink to="/change-password">Change Password</NavLink> ·{" "}
                  <button onClick={handleLogout} style={{ marginLeft: 4 }}>
                    Log out
                  </button>
                </span>
              ) : (
                <NavLink to="/login" style={linkStyle}>
                  Log in
                </NavLink>
              )}
              <ThemeToggleButton />
            </div>
          </header>
          <main style={{ maxWidth: 900, margin: "32px auto", padding: 24 }}>
            <Outlet />
          </main>
        </div>
      </ToastProvider>
    </ThemeProvider>
  );
}
