import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { ReactNode } from "react";

interface User {
  id: number;
  name: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

interface AuthContextValue extends AuthState {
  register: (name: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = "nv_token";
const USER_KEY = "nv_user";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AuthState>(() => ({
    user: (() => {
      try {
        const u = localStorage.getItem(USER_KEY);
        return u ? JSON.parse(u) : null;
      } catch {
        return null;
      }
    })(),
    token: localStorage.getItem(TOKEN_KEY),
    loading: false,
    error: null,
  }));

  const clearError = useCallback(() => setState(s => ({ ...s, error: null })), []);

  const saveSession = useCallback((token: string, user: User) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setState({ user, token, loading: false, error: null });
  }, []);

  const clearSession = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setState({ user: null, token: null, loading: false, error: null });
  }, []);

  const apiCall = useCallback(async (path: string, body: Record<string, unknown>) => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {};
    }
    if (!res.ok) throw new Error((data.detail as string) || `Request failed (${res.status})`);
    return data;
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiCall("/api/auth/register", { name, email, password });
      saveSession(data.token as string, data.user as User);
    } catch (e: unknown) {
      setState(s => ({ ...s, loading: false, error: e instanceof Error ? e.message : "Registration failed" }));
      throw e;
    }
  }, [apiCall, saveSession]);

  const login = useCallback(async (email: string, password: string) => {
    setState(s => ({ ...s, loading: true, error: null }));
    try {
      const data = await apiCall("/api/auth/login", { email, password });
      saveSession(data.token as string, data.user as User);
    } catch (e: unknown) {
      setState(s => ({ ...s, loading: false, error: e instanceof Error ? e.message : "Login failed" }));
      throw e;
    }
  }, [apiCall, saveSession]);

  const logout = useCallback(() => {
    fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    clearSession();
  }, [clearSession]);

  useEffect(() => {
    if (state.token) {
      fetch("/api/auth/me", {
        headers: { Authorization: `Bearer ${state.token}` },
      }).then(res => {
        if (!res.ok) clearSession();
      }).catch(() => clearSession());
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, register, login, logout, clearError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
};
