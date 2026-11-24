"use client";

import * as React from "react";
import { api } from "@/lib/api";

export type UserRole = "RESPONSABLE" | "AGENT" | "PARENT";

export interface User {
  id: number;
  identifiant: string;
  nom: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  isReady: boolean;
  login: (userData: User) => void;
  updateUser: (userData: User) => void;
  logout: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

function isUser(value: unknown): value is User {
  if (!value || typeof value !== "object") return false;
  const user = value as Record<string, unknown>;
  return (
    typeof user.id === "number" &&
    typeof user.identifiant === "string" &&
    typeof user.nom === "string" &&
    (user.role === "RESPONSABLE" || user.role === "AGENT" || user.role === "PARENT")
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [isReady, setIsReady] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem("auth_user");
        if (stored && api.isAuthenticated()) {
          const parsed: unknown = JSON.parse(stored);
          if (isUser(parsed)) {
            setUser(parsed);
          } else {
            console.error("Le profil enregistré ne respecte pas le format attendu.");
            localStorage.removeItem("auth_user");
          }
        }
      } catch (error) {
        console.error("Impossible de restaurer la session enregistrée.", error);
        localStorage.removeItem("auth_user");
      } finally {
        setIsReady(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const updateUser = React.useCallback((userData: User) => {
    setUser(userData);
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_user", JSON.stringify(userData));
    }
  }, []);
  const login = updateUser;

  const logout = async () => {
    setUser(null);
    localStorage.removeItem("auth_user");
    await api.logout();
  };

  return (
    <AuthContext.Provider value={{ user, isReady, login, updateUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth doit être utilisé dans un AuthProvider");
  }
  return ctx;
}