import { useEffect, useState } from "react";
import { AUTH_STORAGE_KEYS, getStoredRole, getStoredUsername, getToken } from "../lib/api";

type AuthState = {
  isAuthenticated: boolean;
  username: string | null;
  role: string | null;
};

function readAuthState(): AuthState {
  return {
    isAuthenticated: getToken() !== null,
    username: getStoredUsername(),
    role: getStoredRole(),
  };
}

export function useAuthState(): AuthState {
  const [state, setState] = useState<AuthState>(readAuthState);

  useEffect(() => {
    const refresh = (): void => setState(readAuthState());
    function handleStorage(event: StorageEvent): void {
      if (event.key === null || AUTH_STORAGE_KEYS.includes(event.key)) refresh();
    }
    window.addEventListener("storage", handleStorage);
    window.addEventListener("academy-auth-changed", refresh);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("academy-auth-changed", refresh);
    };
  }, []);

  return state;
}
