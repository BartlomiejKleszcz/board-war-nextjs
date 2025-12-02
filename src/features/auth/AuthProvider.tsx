"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type SafeUser = {
  id: number;
  email: string;
  displayName: string;
  createdAt: string;
};

type AuthContextValue = {
  user: SafeUser | null;
  token: string | null;
  isReady: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    displayName: string;
    color: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production" ? "/api" : "http://localhost:3000");
const STORAGE_KEY = "boardwar.auth";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SafeUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const persistAuth = useCallback((nextToken: string, nextUser: SafeUser) => {
    if (typeof window === "undefined") return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: nextToken, user: nextUser })
    );
  }, []);

  const clearAuth = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem("currentGameState");
    sessionStorage.removeItem("currentGameId");
    sessionStorage.removeItem("localPlayerId");
  }, []);

  const logout = useCallback(async () => {
    setUser(null);
    setToken(null);
    clearAuth();
    try {
      // Fire-and-forget; backend will simply invalidate on client side.
      await fetch(`${API_BASE_URL}/auth/logout`, { method: "POST" });
    } catch {
      // ignore
    }
  }, [clearAuth]);

  const authFetch = useCallback(
    async (input: string, init?: RequestInit) => {
      const url =
        input.startsWith("http://") || input.startsWith("https://")
          ? input
          : `${API_BASE_URL}${input.startsWith("/") ? input : `/${input}`}`;
      const headers = new Headers(init?.headers ?? {});
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      const res = await fetch(url, { ...init, headers });
      if (res.status === 401) {
        await logout();
        throw new Error("Not authorized. Please sign in again.");
      }
      return res;
    },
    [logout, token]
  );

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to log in.");
      }
      const data = (await res.json()) as { accessToken: string; user: SafeUser };
      setUser(data.user);
      setToken(data.accessToken);
      persistAuth(data.accessToken, data.user);
    },
    [persistAuth]
  );

  const register = useCallback(
    async (input: { email: string; password: string; displayName: string; color: string }) => {
      const res = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) {
        const message = await res.text();
        throw new Error(message || "Failed to create account.");
      }
      const data = (await res.json()) as { accessToken: string; user: SafeUser };
      setUser(data.user);
      setToken(data.accessToken);
      persistAuth(data.accessToken, data.user);
    },
    [persistAuth]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      setIsReady(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as { token?: string; user?: SafeUser };
      if (parsed?.token) {
        setToken(parsed.token);
        if (parsed.user) {
          setUser(parsed.user);
        }

        fetch(`${API_BASE_URL}/auth/me`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${parsed.token}` },
        })
          .then(async (res) => {
            if (!res.ok) {
              throw new Error("Token invalid");
            }
            const me = (await res.json()) as SafeUser;
            setUser(me);
            persistAuth(parsed.token!, me);
          })
          .catch(() => {
            void logout();
          })
          .finally(() => setIsReady(true));
      } else {
        setIsReady(true);
      }
    } catch (e) {
      console.error("Failed to parse stored auth data", e);
      setIsReady(true);
    }
  }, [logout, persistAuth]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isReady,
      login,
      register,
      logout,
      authFetch,
    }),
    [authFetch, isReady, login, logout, register, token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
