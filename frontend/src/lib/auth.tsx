import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setUnauthorizedHandler, tokenStore } from "./api";
import type { Role, TokenResponse, User } from "./types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  /** Citizens are signed in immediately (returns the user); staff requests return { pending } and stay signed out. */
  register: (data: RegisterData) => Promise<User | PendingRequest>;
  logout: () => void;
  refresh: () => Promise<void>;
}

export interface RegisterData {
  email: string;
  full_name: string;
  password: string;
  phone?: string;
  preferred_language: string;
  role?: "citizen" | "officer";
  department_code?: string;
  designation?: string;
}
export interface PendingRequest {
  pending: true;
  role: string;
  department: string;
  message: string;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    tokenStore.set(null);
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    try {
      setUser(await api<User>("/auth/me"));
    } catch {
      tokenStore.set(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(logout);
    void refresh();
  }, [logout, refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<TokenResponse>("/auth/login", { body: { email, password }, auth: false });
    tokenStore.set(res.access_token);
    setUser(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (data: RegisterData) => {
    const res = await api<TokenResponse | PendingRequest>("/auth/register", { body: data, auth: false });
    if ("pending" in res) return res;
    tokenStore.set(res.access_token);
    setUser(res.user);
    return res.user;
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout, refresh }), [user, loading, login, register, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function homeFor(role: Role): string {
  return { admin: "/admin", dept_admin: "/department", officer: "/officer", citizen: "/citizen" }[role] ?? "/";
}

export const ROLE_LABEL: Record<Role, string> = {
  citizen: "Citizen",
  officer: "Grievance Officer",
  dept_admin: "Department Admin",
  admin: "System Admin",
};
