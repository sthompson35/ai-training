import React, { useState } from "react";
import { resolveServiceMember, ServiceMember } from "../lib/api";

type Props = {
  value: string;
  onChange: (value: string) => void;
  label: string;
  required?: boolean;
};

type Status = "idle" | "loading" | "resolved" | "error";

// Controlled identifier input with live resolve-on-blur feedback. The raw text
// the user types is what gets submitted — the backend does the canonicalization
// (any of service_member_id / callsign_id / callsign / legacy_alias resolves).
// This component only calls the resolve endpoint to show a helper hint; it
// never rewrites `value` itself.
export function IdentityPicker({ value, onChange, label, required }: Props): React.ReactElement {
  const [status, setStatus] = useState<Status>("idle");
  const [resolved, setResolved] = useState<ServiceMember | null>(null);

  async function handleBlur(): Promise<void> {
    const identifier = value.trim();
    if (!identifier) {
      setStatus("idle");
      setResolved(null);
      return;
    }
    setStatus("loading");
    try {
      const member = await resolveServiceMember(identifier);
      setResolved(member);
      setStatus("resolved");
    } catch {
      setResolved(null);
      setStatus("error");
    }
  }

  function handleChange(next: string): void {
    onChange(next);
    // Typing invalidates any prior resolve result — don't show a stale
    // checkmark/error while the user is still editing. The next fetch only
    // happens on blur, not on every keystroke.
    if (status !== "idle") {
      setStatus("idle");
      setResolved(null);
    }
  }

  return (
    <div>
      <label>
        {label}
        <input required={required} value={value} onChange={(e) => handleChange(e.target.value)} onBlur={handleBlur} />
      </label>
      {status === "loading" && (
        <div style={{ fontSize: "0.85em", color: "var(--color-text-muted)" }}>Resolving…</div>
      )}
      {status === "resolved" && resolved && (
        <div style={{ fontSize: "0.85em", color: "#1e6b3c" }}>
          ✓ {resolved.display_name} — {resolved.callsign}
        </div>
      )}
      {status === "error" && (
        <div role="alert" style={{ fontSize: "0.85em", color: "#b3261e" }}>
          Does not resolve to a known identity
        </div>
      )}
    </div>
  );
}
