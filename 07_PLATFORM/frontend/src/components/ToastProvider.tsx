import React, { createContext, useContext, useState } from "react";

type Variant = "success" | "error";
type ToastAction = { label: string; onClick: () => void };
type Toast = { id: number; message: string; variant: Variant; action?: ToastAction };
type ToastContextValue = {
  success: (message: string, action?: ToastAction) => void;
  error: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);
export const UNDO_WINDOW_MS = 5000;
const DISMISS_AFTER_MS = UNDO_WINDOW_MS;

function variantStyle(variant: Variant): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 6,
    minWidth: 240,
    maxWidth: 420,
    boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
    color: "#fff",
    background: variant === "error" ? "#b3261e" : "#1e6b3c",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  };
}

export function ToastProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [toasts, setToasts] = useState<Toast[]>([]);

  function dismiss(id: number): void {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }

  function push(message: string, variant: Variant, action?: ToastAction): void {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, variant, action }]);
    setTimeout(() => dismiss(id), DISMISS_AFTER_MS);
  }

  const value: ToastContextValue = {
    success: (message, action) => push(message, "success", action),
    error: (message) => push(message, "error"),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {toasts.map((t) => (
          <div key={t.id} role={t.variant === "error" ? "alert" : "status"} style={variantStyle(t.variant)}>
            <span>{t.message}</span>
            <span style={{ display: "flex", alignItems: "center" }}>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                  style={{
                    marginLeft: 12,
                    background: "none",
                    border: "1px solid #fff",
                    borderRadius: 4,
                    color: "#fff",
                    cursor: "pointer",
                    padding: "2px 8px",
                  }}
                >
                  {t.action.label}
                </button>
              )}
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                style={{ marginLeft: 12, background: "none", border: "none", color: "#fff", cursor: "pointer" }}
              >
                ×
              </button>
            </span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
