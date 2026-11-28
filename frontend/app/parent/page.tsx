"use client";

import * as React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUsers,
  faUser,
  faClock,
  faExclamationTriangle,
  faCheckCircle,
  faBell,
  faSignOutAlt,
} from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/button";
import { Badge } from "@/components/badge";
import { useAuth } from "@/contexts/auth-context";
import { RoleGate } from "@/components/role-gate";
import { WorkspaceShell } from "@/components/workspace-shell";

const ANOMALIE_CONFIG: Record<string, { color: string; bg: string; border: string }> = {
  ABSENCE: {
    color: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-100",
  },
  HORS_FENETRE: {
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-100",
  },
  DOUBLE_SCAN: {
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-100",
  },
};

interface PassageRecord {
  id: number;
  eleve_nom: string;
  point_libelle: string;
  heure_locale: string;
}

interface AnomalieRecord {
  id: number;
  eleve_nom: string;
  type: string;
  date: string;
  traite: boolean;
}

interface NotificationRecord {
  id: number;
  eleve_nom: string;
  anomalie_type: string;
  anomalie_date: string;
  texte: string;
  etat: string;
  date: string;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Douala",
  });
}

function ParentWorkspace() {
  const { user, logout } = useAuth();
  const [enfants, setEnfants] = React.useState<Array<{
    id: number;
    nom: string;
    classe: string;
    etablissement: string;
  }>>([]);
  const [selectedEnfant, setSelectedEnfant] = React.useState<number | null>(null);
  const [passages, setPassages] = React.useState<PassageRecord[]>([]);
  const [anomalies, setAnomalies] = React.useState<AnomalieRecord[]>([]);
  const [notifications, setNotifications] = React.useState<NotificationRecord[]>([]);
  const [notificationError, setNotificationError] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchNotifications = React.useCallback(async () => {
    const res = await fetch("/api/parent/notifications/", {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("access_token")}`,
      },
    });
    if (!res.ok) {
      throw new Error("Impossible de charger les notifications.");
    }
    setNotifications((await res.json()) as NotificationRecord[]);
    setNotificationError("");
  }, []);

  const fetchEnfantData = React.useCallback(async (eleveId: number) => {
    try {
      const [passagesRes, anomaliesRes] = await Promise.all([
        fetch(`/api/parent/enfants/${eleveId}/passages`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }),
        fetch(`/api/parent/enfants/${eleveId}/anomalies`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        }),
      ]);

      if (passagesRes.ok) setPassages((await passagesRes.json()) as PassageRecord[]);
      if (anomaliesRes.ok) setAnomalies((await anomaliesRes.json()) as AnomalieRecord[]);
    } catch {
      // Ignorer
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchEnfants = React.useCallback(async () => {
    try {
      const res = await fetch("/api/parent/enfants", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
      });
      if (res.ok) {
        const data = (await res.json()) as Array<{
          id: number;
          nom: string;
          classe: string;
          etablissement: string;
        }>;
        setEnfants(data);
        if (data.length > 0) {
          setSelectedEnfant(data[0].id);
          await fetchEnfantData(data[0].id);
        }
      }
    } catch {
      // Ignorer
    } finally {
      setIsLoading(false);
    }
  }, [fetchEnfantData]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchEnfants();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchEnfants]);

  React.useEffect(() => {
    let active = true;
    const loadNotifications = () => {
      void fetchNotifications().catch((error: unknown) => {
        if (active) {
          setNotificationError(error instanceof Error ? error.message : "Impossible de charger les notifications.");
        }
      });
    };
    loadNotifications();
    const interval = window.setInterval(loadNotifications, 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [fetchNotifications]);

  const handleEnfantChange = (id: number) => {
    setSelectedEnfant(id);
    setIsLoading(true);
    fetchEnfantData(id);
  };

  const enfant = enfants.find((e) => e.id === selectedEnfant);
  const totalPassages = passages.length;
  const totalAnomalies = anomalies.length;
  const anomaliesNonTraitees = anomalies.filter((a) => !a.traite).length;

  return (
    <WorkspaceShell role="PARENT">
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#9a7522]">Espace famille</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#183b32] sm:text-4xl">Bonjour{user?.nom ? `, ${user.nom}` : ""}</h1>
          <p className="mt-2 text-sm text-[#718078]">Un aperçu simple et rassurant de la journée de votre enfant.</p>
        </div>
        <Button variant="ghost" size="sm" onClick={logout} className="self-start !rounded-full !border !border-[#e4e6dc] !bg-white !px-4 !py-2.5 !text-[#52655e] hover:!bg-[#f2f4ee] sm:self-auto">
          <FontAwesomeIcon icon={faSignOutAlt} className="mr-2 h-3 w-3" />
          Déconnexion
        </Button>
      </header>

      <section className="mb-6 grid gap-5 rounded-[1.5rem] border border-[#e4e6dc] bg-white p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#eaf1e9] text-lg font-bold text-[#28634a]">
            {enfant?.nom.charAt(0) || <FontAwesomeIcon icon={faUsers} className="h-5 w-5" />}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#9a7522]">Enfant suivi</p>
            {enfant ? (
              <>
                <h2 className="mt-1 truncate text-lg font-semibold text-[#183b32]">{enfant.nom}</h2>
                <p className="mt-0.5 truncate text-xs text-[#87938b]">{enfant.classe} · {enfant.etablissement}</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-[#718078]">{isLoading ? "Chargement de votre espace…" : "Aucun enfant associé à ce compte."}</p>
            )}
          </div>
        </div>
        <div className="w-full lg:w-[260px]">
          <label htmlFor="child-select" className="mb-2 block text-xs font-semibold text-[#52655e]">Changer d’enfant</label>
          <select
            id="child-select"
            value={selectedEnfant || ""}
            onChange={(e) => handleEnfantChange(parseInt(e.target.value, 10))}
            disabled={enfants.length === 0}
            className="w-full rounded-xl border border-[#dfe5da] bg-[#fcfcf9] px-4 py-3 text-sm text-[#43564d] outline-none transition focus:border-[#527963] focus:ring-4 focus:ring-[#527963]/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {enfants.length === 0 && <option value="">Aucun enfant disponible</option>}
            {enfants.map((e) => (
              <option key={e.id} value={e.id}>{e.nom} — {e.classe}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Passages enregistrés", value: totalPassages, icon: faClock, tone: "bg-[#eaf1e9] text-[#28634a]" },
          { label: "Anomalies détectées", value: totalAnomalies, icon: faExclamationTriangle, tone: "bg-[#f8ece8] text-[#a94f3c]" },
          { label: "À vérifier", value: anomaliesNonTraitees, icon: faCheckCircle, tone: "bg-[#f8f0da] text-[#927021]" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[1.25rem] border border-[#e4e6dc] bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-[#87938b]">{stat.label}</p>
                <p className="mt-2 text-3xl font-semibold tracking-tight text-[#183b32]">{stat.value}</p>
              </div>
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.tone}`}>
                <FontAwesomeIcon icon={stat.icon} className="h-4 w-4" />
              </span>
            </div>
          </div>
        ))}
      </section>

      <section className="mb-6 overflow-hidden rounded-[1.5rem] border border-[#e4e6dc] bg-white">
        <div className="flex items-center justify-between border-b border-[#edf0e9] px-5 py-5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff4df] text-[#956b16]">
              <FontAwesomeIcon icon={faBell} className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-semibold text-[#183b32]">Notifications</h2>
              <p className="mt-1 text-xs text-[#87938b]">Messages reçus pour vos enfants</p>
            </div>
          </div>
          <span className="rounded-full bg-[#f2f4ee] px-3 py-1.5 text-xs font-semibold text-[#718078]">
            {notifications.length}
          </span>
        </div>
        {notificationError ? (
          <p role="alert" className="px-5 py-4 text-sm text-red-700">{notificationError}</p>
        ) : notifications.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[#718078]">Aucune notification pour le moment.</p>
        ) : (
          <ul className="divide-y divide-[#edf0e9]">
            {notifications.map((notification) => (
              <li key={notification.id} className="px-5 py-4 sm:px-6">
                <p className="text-sm font-semibold text-[#354c41]">{notification.eleve_nom}</p>
                <p className="mt-1 text-sm leading-6 text-[#52655e]">{notification.texte}</p>
                <p className="mt-1 text-xs text-[#87938b]">{formatDateTime(notification.date)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid items-start gap-5 lg:grid-cols-2">
        <div className="overflow-hidden rounded-[1.5rem] border border-[#e4e6dc] bg-white">
          <div className="flex items-center justify-between border-b border-[#edf0e9] px-5 py-5 sm:px-6">
            <div>
              <h2 className="font-semibold text-[#183b32]">Passages récents</h2>
              <p className="mt-1 text-xs text-[#87938b]">Les dernières entrées et sorties</p>
            </div>
            <span className="rounded-full bg-[#f2f4ee] px-3 py-1.5 text-xs font-semibold text-[#718078]">{passages.length}</span>
          </div>
          {passages.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f2f4ee] text-[#84948a]">
                <FontAwesomeIcon icon={faClock} className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-[#52655e]">{isLoading ? "Chargement des passages…" : "Aucun passage enregistré"}</p>
              <p className="mt-1 text-xs text-[#98a39b]">Les passages récents apparaîtront ici.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#edf0e9]">
              {passages.map((p, idx) => (
                <div key={p.id || idx} className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eaf1e9] text-[#28634a]">
                      <FontAwesomeIcon icon={faUser} className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-[#354c41]">{p.eleve_nom || enfant?.nom}</p>
                      <p className="mt-0.5 truncate text-xs text-[#87938b]">
                        {p.point_libelle} · {formatDateTime(p.heure_locale)}
                      </p>
                    </div>
                  </div>
                  <Badge variant="success">Validé</Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="overflow-hidden rounded-[1.5rem] border border-[#e4e6dc] bg-white">
          <div className="flex items-center justify-between border-b border-[#edf0e9] px-5 py-5 sm:px-6">
            <div>
              <h2 className="font-semibold text-[#183b32]">Anomalies</h2>
              <p className="mt-1 text-xs text-[#87938b]">Éléments nécessitant votre attention</p>
            </div>
            <span className={`rounded-full px-3 py-1.5 text-xs font-semibold ${totalAnomalies ? "bg-[#f8ece8] text-[#a94f3c]" : "bg-[#eaf1e9] text-[#28634a]"}`}>
              {anomalies.length}
            </span>
          </div>
          {anomalies.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf1e9] text-[#28634a]">
                <FontAwesomeIcon icon={faCheckCircle} className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-[#52655e]">{isLoading ? "Vérification en cours…" : "Tout va bien"}</p>
              <p className="mt-1 text-xs text-[#98a39b]">Aucune anomalie détectée pour le moment.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#edf0e9]">
              {anomalies.map((a, idx) => {
                const config = ANOMALIE_CONFIG[a.type] || ANOMALIE_CONFIG.ABSENCE;
                return (
                  <div key={a.id || idx} className="flex items-center justify-between gap-3 px-5 py-4 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${config.bg} ${config.color}`}>
                        <FontAwesomeIcon icon={faExclamationTriangle} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#354c41]">{a.eleve_nom || enfant?.nom}</p>
                        <p className="mt-0.5 text-xs text-[#87938b]">
                          {new Date(`${a.date}T00:00:00`).toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })}
                          {!a.traite && <span className="ml-2 font-semibold text-[#a94f3c]">· À vérifier</span>}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={a.type === "ABSENCE" ? "danger" : a.type === "HORS_FENETRE" ? "warning" : "info"}
                      className={`shrink-0 text-[10px] ${config.color} ${config.bg} ${config.border}`}
                    >
                      {a.type}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
    </WorkspaceShell>
  );
}

export default function ParentPage() {
  return (
    <RoleGate role="PARENT">
      <ParentWorkspace />
    </RoleGate>
  );
}
