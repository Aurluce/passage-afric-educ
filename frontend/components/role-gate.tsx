"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuth, type UserRole } from "@/contexts/auth-context";

const ROLE_HOME: Record<UserRole, string> = {
  RESPONSABLE: "/responsable",
  AGENT: "/scan",
  PARENT: "/parent",
};

export function RoleGate({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isReady } = useAuth();
  const hasAccess = isReady && !!user && user.role === role && api.isAuthenticated();

  React.useEffect(() => {
    if (!isReady) return;
    if (!user || !api.isAuthenticated()) {
      router.replace("/login");
    } else if (user.role !== role) {
      router.replace(ROLE_HOME[user.role]);
    }
  }, [isReady, role, router, user]);

  if (!hasAccess) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-[#f7f7f1] px-5">
        <p role="status" className="text-sm font-medium text-[#52655e]">
          Vérification de votre espace…
        </p>
      </main>
    );
  }

  return children;
}
