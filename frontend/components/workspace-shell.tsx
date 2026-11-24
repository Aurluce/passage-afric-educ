"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRightFromBracket,
  faIdCard,
  faUser,
  faUserShield,
  faUserGraduate,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { useAuth, type UserRole } from "@/contexts/auth-context";
import { Button } from "@/components/button";

const ROLE_DETAILS: Record<UserRole, { label: string; href: string; icon: typeof faIdCard }> = {
  RESPONSABLE: { label: "Espace responsable", href: "/responsable", icon: faUserShield },
  AGENT: { label: "Espace agent", href: "/scan", icon: faIdCard },
  PARENT: { label: "Espace parent", href: "/parent", icon: faUsers },
};

export function WorkspaceShell({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [logoutError, setLogoutError] = React.useState("");
  const details = ROLE_DETAILS[role];
  const navigation = role === "RESPONSABLE"
    ? [
        { label: "Élèves", href: "/responsable", icon: faUserGraduate },
        { label: "Badges", href: "/responsable/badges", icon: faIdCard },
        { label: "Mon compte", href: "/responsable/compte", icon: faUser },
      ]
    : [{ label: details.label, href: details.href, icon: details.icon }];

  const handleLogout = async () => {
    setLogoutError("");
    try {
      await logout();
    } catch (error) {
      console.error("La session locale est fermée, mais le serveur n’a pas confirmé la déconnexion.", error);
      setLogoutError("La session locale est fermée. Vérifiez votre connexion pour invalider la session serveur.");
    } finally {
      router.replace("/login");
    }
  };

  return (
    <div className="min-h-svh bg-[#f7f7f1]">
      <header className="sticky top-0 z-30 border-b border-[#e4e6dc] bg-[#f7f7f1]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
          <Link href={details.href} className="flex shrink-0 items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1d4b3b] text-[#f0ca70]">
              <FontAwesomeIcon icon={details.icon} className="h-4 w-4" />
            </span>
            <span className="hidden sm:block">
              <span className="block text-sm font-bold text-[#183b32]">Passage</span>
              <span className="block text-[11px] text-[#87938b]">Afric&apos;Éduc</span>
            </span>
          </Link>

          <nav
            aria-label="Navigation principale"
            className={`flex items-center gap-1 ${
              role === "RESPONSABLE"
                ? "order-3 w-full flex-nowrap overflow-x-auto border-t border-[#edf0e9] pt-2 sm:order-none sm:w-auto sm:justify-center sm:border-0 sm:pt-0"
                : "flex-1 justify-center sm:flex-none"
            }`}
          >
            {navigation.map((item) => {
              const isCurrent = pathname === item.href
                || (item.href !== "/responsable" && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isCurrent ? "page" : undefined}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                    isCurrent
                      ? "bg-[#eaf1e9] text-[#28634a]"
                      : "text-[#718078] hover:bg-white hover:text-[#28634a]"
                  }`}
                >
                  <FontAwesomeIcon icon={item.icon} className="h-3.5 w-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2 sm:gap-4">
            <div className="hidden text-right sm:block">
              <p className="max-w-36 truncate text-xs font-semibold text-[#354c41]">{user?.nom || user?.identifiant}</p>
              <p className="text-[10px] text-[#87938b]">{user?.identifiant}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="!rounded-full !border !border-[#e4e6dc] !bg-white !px-3 !text-[#52655e] hover:!bg-[#f2f4ee] sm:!px-4"
              aria-label="Se déconnecter"
            >
              <FontAwesomeIcon icon={faArrowRightFromBracket} className="h-3.5 w-3.5 sm:mr-2" />
              <span className="hidden sm:inline">Déconnexion</span>
            </Button>
          </div>
        </div>
      </header>
      {logoutError && (
        <p role="alert" className="mx-auto mt-4 max-w-7xl px-4 text-sm text-amber-800 sm:px-6 lg:px-8">
          {logoutError}
        </p>
      )}
      <main>{children}</main>
    </div>
  );
}
