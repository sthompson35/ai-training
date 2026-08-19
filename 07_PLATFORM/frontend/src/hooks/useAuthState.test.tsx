import { afterEach, describe, expect, it } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAuthState } from "./useAuthState";

afterEach(() => {
  localStorage.clear();
});

describe("useAuthState", () => {
  it("reflects the current localStorage auth state on initial render", () => {
    localStorage.setItem("academy_token", "tok-1");
    localStorage.setItem("academy_username", "admin");
    localStorage.setItem("academy_role", "admin");

    const { result } = renderHook(() => useAuthState());

    expect(result.current).toEqual({ isAuthenticated: true, username: "admin", role: "admin" });
  });

  it("updates when a same-tab academy-auth-changed event fires", () => {
    const { result } = renderHook(() => useAuthState());
    expect(result.current.isAuthenticated).toBe(false);

    act(() => {
      localStorage.setItem("academy_token", "tok-2");
      localStorage.setItem("academy_username", "contributor");
      localStorage.setItem("academy_role", "contributor");
      window.dispatchEvent(new Event("academy-auth-changed"));
    });

    expect(result.current).toEqual({ isAuthenticated: true, username: "contributor", role: "contributor" });
  });

  it("updates when a cross-tab storage event fires for an auth key", () => {
    const { result } = renderHook(() => useAuthState());

    act(() => {
      localStorage.setItem("academy_token", "tok-3");
      localStorage.setItem("academy_username", "admin");
      localStorage.setItem("academy_role", "admin");
      window.dispatchEvent(new StorageEvent("storage", { key: "academy_token" }));
    });

    expect(result.current).toEqual({ isAuthenticated: true, username: "admin", role: "admin" });
  });

  it("ignores storage events for unrelated keys", () => {
    const { result } = renderHook(() => useAuthState());
    const before = result.current;

    act(() => {
      localStorage.setItem("some_other_key", "value");
      window.dispatchEvent(new StorageEvent("storage", { key: "some_other_key" }));
    });

    expect(result.current).toEqual(before);
  });
});
