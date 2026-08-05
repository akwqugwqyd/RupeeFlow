import type { ReactNode } from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type User = {
  id: string;
  name: string;
  email: string;
  currency: string;
  monthlyIncomeTarget: number;
};

type AuthContextValue = {
  user: User | null;
  login: (payload: Record<string, unknown>, mode?: "login" | "register") => Promise<void>;
  updateUser: (user: User) => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  loading: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem("rupeeflow_user");
    try {
      return raw ? JSON.parse(raw) : null;
    } catch {
      localStorage.removeItem("rupeeflow_user");
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  async function login(payload, mode = "login") {
    const { data } = await api.post(`/auth/${mode}`, payload);
    localStorage.setItem("rupeeflow_user", JSON.stringify(data.user));
    setUser(data.user);
  }

  async function logout() {
    try {
      await api.post("/auth/logout");
    } catch {
      // Local session cleanup should still happen if the server session is already gone.
    }
    localStorage.removeItem("rupeeflow_user");
    setUser(null);
  }

  function updateUser(nextUser: User) {
    localStorage.setItem("rupeeflow_user", JSON.stringify(nextUser));
    setUser(nextUser);
  }

  useEffect(() => {
    localStorage.removeItem("rupeeflow_token");
    api.get("/auth/me")
      .then(({ data }) => {
        localStorage.setItem("rupeeflow_user", JSON.stringify(data.user));
        setUser(data.user);
      })
      .catch(() => {
        localStorage.removeItem("rupeeflow_user");
        setUser(null);
      })
      .finally(() => setLoading(false));

    window.addEventListener("rupeeflow:unauthorized", logout);
    return () => window.removeEventListener("rupeeflow:unauthorized", logout);
  }, []);

  const value = useMemo(() => ({ user, login, updateUser, logout, isAuthenticated: Boolean(user), loading }), [user, loading]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
