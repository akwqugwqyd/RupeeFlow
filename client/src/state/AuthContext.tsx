import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";
import { api } from "../lib/api";

type User = {
  id: string;
  name: string;
  email: string;
  currency: string;
  monthlyIncomeTarget: number;
};

type AuthContextValue = {
  token: string | null;
  user: User | null;
  login: (payload: Record<string, unknown>, mode?: "login" | "register") => Promise<void>;
  updateUser: (user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState(localStorage.getItem("rupeeflow_token"));
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("rupeeflow_user");
    return raw ? JSON.parse(raw) : null;
  });

  async function login(payload, mode = "login") {
    const { data } = await api.post(`/auth/${mode}`, payload);
    localStorage.setItem("rupeeflow_token", data.token);
    localStorage.setItem("rupeeflow_user", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
  }

  function logout() {
    localStorage.removeItem("rupeeflow_token");
    localStorage.removeItem("rupeeflow_user");
    setToken(null);
    setUser(null);
  }

  function updateUser(nextUser: User) {
    localStorage.setItem("rupeeflow_user", JSON.stringify(nextUser));
    setUser(nextUser);
  }

  const value = useMemo(() => ({ token, user, login, updateUser, logout, isAuthenticated: Boolean(token) }), [token, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
