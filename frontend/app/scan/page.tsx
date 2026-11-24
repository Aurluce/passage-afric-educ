"use client";

import * as React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faIdCard,
  faCheck,
  faTimes,
  faSync,
  faMobileScreen,
  faWifi,
} from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/button";
import { Badge } from "@/components/badge";
import { useAuth } from "@/contexts/auth-context";
import { RoleGate } from "@/components/role-gate";
import { WorkspaceShell } from "@/components/workspace-shell";

interface PassageScan {
  event_id_local: string;
  badge_id: number;
  badge_code: string;
  point_id: number;
  heure_locale: string;
}

const POINTS = [
  { id: 1, libelle: "Portail — Entrée" },
  { id: 2, libelle: "Portail — Sortie" },
];

function ScanWorkspace() {
  const { user, logout } = useAuth();
  const [badgeCode, setBadgeCode] = React.useState("");
  const [pointId, setPointId] = React.useState("1");
  const [isScanning, setIsScanning] = React.useState(false);
  const [isOnline, setIsOnline] = React.useState(true);
  const [lastResult, setLastResult] = React.useState<{
    created: number;
    ignored: number;
    rejected_clock: number;
    rejected_badge: number;
    details: string[];
  } | null>(null);
  const [scanHistory, setScanHistory] = React.useState<Array<{
    badge: string;
    point: string;
    time: string;
    status: "success" | "error";
  }>>([]);
  const [offlineScans, setOfflineScans] = React.useState<PassageScan[]>([]);
  const [offlineScansLoaded, setOfflineScansLoaded] = React.useState(false);
  const [localDateTime, setLocalDateTime] = React.useState("");

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem("offline_scans");
        if (stored) {
          setOfflineScans(JSON.parse(stored));
        }
      } catch (error) {
        console.error("Impossible de lire les scans hors ligne enregistrés.", error);
      } finally {
        setOfflineScansLoaded(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  React.useEffect(() => {
    if (!offlineScansLoaded) return;
    localStorage.setItem("offline_scans", JSON.stringify(offlineScans));
  }, [offlineScans, offlineScansLoaded]);

  React.useEffect(() => {
    const updateLocalDateTime = () => {
      const now = new Date();
      const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
        .toISOString()
        .slice(0, 16);
      setLocalDateTime(localTime);
    };
    updateLocalDateTime();
    const intervalId = window.setInterval(updateLocalDateTime, 60_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!badgeCode.trim()) return;

    const passage: PassageScan = {
      event_id_local: crypto.randomUUID(),
      badge_id: parseInt(badgeCode, 10) || 0,
      badge_code: badgeCode,
      point_id: parseInt(pointId, 10),
      heure_locale: new Date().toISOString(),
    };

    setIsScanning(true);
    setLastResult(null);

    if (!isOnline) {
      setOfflineScans([...offlineScans, passage]);
      setScanHistory([
        {
          badge: badgeCode,
          point: POINTS.find((p) => p.id === parseInt(pointId))?.libelle || "Inconnu",
          time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          status: "success" as const,
        },
        ...scanHistory,
      ].slice(0, 10));
      setBadgeCode("");
      setIsScanning(false);
      return;
    }

    try {
      const res = await fetch("/api/passages/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({
          appareil_id: "dev-agent-01",
          passages: [passage],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setLastResult(data);
        setScanHistory([
          {
            badge: badgeCode,
            point: POINTS.find((p) => p.id === parseInt(pointId))?.libelle || "Inconnu",
            time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
            status: "success" as const,
          },
          ...scanHistory,
        ].slice(0, 10));
      } else {
        setScanHistory([
          {
            badge: badgeCode,
            point: POINTS.find((p) => p.id === parseInt(pointId))?.libelle || "Inconnu",
            time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
            status: "error" as const,
          },
          ...scanHistory,
        ].slice(0, 10));
      }
    } catch {
      setOfflineScans([...offlineScans, passage]);
      setIsOnline(false);
      setScanHistory([
        {
          badge: badgeCode,
          point: POINTS.find((p) => p.id === parseInt(pointId))?.libelle || "Inconnu",
          time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
          status: "success" as const,
        },
        ...scanHistory,
      ].slice(0, 10));
    } finally {
      setBadgeCode("");
      setIsScanning(false);
    }
  };

  const syncOffline = async () => {
    if (offlineScans.length === 0) return;
    try {
      const res = await fetch("/api/passages/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`,
        },
        body: JSON.stringify({
          appareil_id: "dev-agent-01",
          passages: offlineScans,
        }),
      });
      if (res.ok) {
        setOfflineScans([]);
        localStorage.removeItem("offline_scans");
      }
    } catch {
      // Ignorer, reste en hors ligne
    }
  };

  return (
    <WorkspaceShell role="AGENT">
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#9a7522]">Espace agent</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#183b32] sm:text-4xl">Pointage des élèves</h1>
          <p className="mt-2 text-sm text-[#718078]">
            Connecté en tant que <span className="font-semibold text-[#43564d]">{user?.identifiant}</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold ${
            isOnline
              ? "border-[#d2e3d5] bg-[#eaf1e9] text-[#28634a]"
              : "border-[#f0dfb5] bg-[#fbf4df] text-[#927021]"
          }`}>
            <FontAwesomeIcon icon={isOnline ? faWifi : faMobileScreen} className="h-3 w-3" />
            {isOnline ? "Connecté" : "Mode hors ligne"}
          </span>
          {offlineScans.length > 0 && (
            <Button variant="outline" size="sm" onClick={syncOffline} disabled={!isOnline} className="!rounded-full !border-[#dfe5da] !text-[#365a48]">
              <FontAwesomeIcon icon={faSync} className="mr-2 h-3 w-3" />
              Synchroniser · {offlineScans.length}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={logout} className="!rounded-full !text-[#718078] hover:!bg-white">
            <FontAwesomeIcon icon={faTimes} className="mr-2 h-3 w-3" />
            Déconnexion
          </Button>
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-[1.5rem] border border-[#e4e6dc] bg-white shadow-[0_12px_36px_rgba(29,75,59,0.06)]">
            <div className="border-b border-[#edf0e9] px-5 py-5 sm:px-7">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf1e9] text-[#28634a]">
                  <FontAwesomeIcon icon={faIdCard} className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="font-semibold text-[#183b32]">Enregistrer un passage</h2>
                  <p className="mt-0.5 text-xs text-[#87938b]">Saisissez ou scannez le code du badge élève.</p>
                </div>
              </div>
            </div>
            <form onSubmit={handleScan} className="grid gap-5 p-5 sm:p-7 md:grid-cols-2">
              <div className="md:col-span-2">
                <label htmlFor="badge-code" className="mb-2 block text-sm font-semibold text-[#43564d]">Code du badge</label>
                <input
                  id="badge-code"
                  type="text"
                  autoFocus
                  className="w-full rounded-xl border border-[#dfe5da] bg-[#fcfcf9] px-4 py-3.5 text-base text-[#183b32] outline-none transition placeholder:text-[#a3ada5] focus:border-[#527963] focus:bg-white focus:ring-4 focus:ring-[#527963]/10"
                  placeholder="Ex. : E12345"
                  value={badgeCode}
                  onChange={(e) => setBadgeCode(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="point-id" className="mb-2 block text-sm font-semibold text-[#43564d]">Point de contrôle</label>
                <select
                  id="point-id"
                  value={pointId}
                  onChange={(e) => setPointId(e.target.value)}
                  className="w-full rounded-xl border border-[#dfe5da] bg-white px-4 py-3 text-sm text-[#43564d] outline-none transition focus:border-[#527963] focus:ring-4 focus:ring-[#527963]/10"
                >
                  {POINTS.map((p) => (
                    <option key={p.id} value={p.id}>{p.libelle}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="scan-time" className="mb-2 block text-sm font-semibold text-[#43564d]">Heure locale</label>
                <input
                  id="scan-time"
                  type="datetime-local"
                  value={localDateTime}
                  readOnly
                  className="w-full cursor-not-allowed rounded-xl border border-[#e9ebe3] bg-[#f7f8f4] px-4 py-3 text-sm text-[#839087]"
                />
              </div>
              <Button type="submit" size="lg" isLoading={isScanning} className="md:col-span-2 !rounded-xl !bg-[#1d4b3b] py-3.5 text-sm hover:!bg-[#14392f]">
                <FontAwesomeIcon icon={faIdCard} className="mr-2 h-4 w-4" />
                {isScanning ? "Enregistrement en cours…" : "Enregistrer le passage"}
              </Button>
            </form>
          </section>

          {lastResult && (
            <section role="status" className="rounded-2xl border border-[#d2e3d5] bg-[#edf5ee] p-5">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#28634a]">
                  <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-semibold text-[#23573f]">Passage enregistré</h3>
                  <p className="mt-1 text-sm leading-6 text-[#527963]">
                    {lastResult.created} créé(s) · {lastResult.ignored} ignoré(s) · {lastResult.rejected_clock} rejeté(s) (horloge) · {lastResult.rejected_badge} rejeté(s) (badge)
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="overflow-hidden rounded-[1.5rem] border border-[#e4e6dc] bg-white">
            <div className="flex items-center justify-between border-b border-[#edf0e9] px-5 py-5 sm:px-6">
              <div>
                <h2 className="font-semibold text-[#183b32]">Historique des scans</h2>
                <p className="mt-1 text-xs text-[#87938b]">Les passages récents de cet appareil</p>
              </div>
              <span className="rounded-full bg-[#f2f4ee] px-3 py-1.5 text-xs font-semibold text-[#718078]">{scanHistory.length} entrée(s)</span>
            </div>
            {scanHistory.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f2f4ee] text-[#84948a]">
                  <FontAwesomeIcon icon={faMobileScreen} className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-[#52655e]">Aucun scan pour le moment</p>
                <p className="mt-1 text-xs text-[#98a39b]">Les passages enregistrés apparaîtront ici.</p>
              </div>
            ) : (
              <div className="divide-y divide-[#edf0e9]">
                {scanHistory.map((scan, idx) => (
                  <div key={`${scan.badge}-${idx}`} className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f2f4ee] text-[#527963]">
                        <FontAwesomeIcon icon={faIdCard} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#354c41]">{scan.badge}</p>
                        <p className="mt-0.5 truncate text-xs text-[#87938b]">{scan.point} · {scan.time}</p>
                      </div>
                    </div>
                    <Badge variant={scan.status === "success" ? "success" : "danger"}>
                      {scan.status === "success" ? "Validé" : "Erreur"}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-[1.5rem] bg-[#163f35] p-5 text-white sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/55">État de l’appareil</p>
            <div className="mt-5 flex items-center gap-3">
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isOnline ? "bg-[#dcebdc] text-[#28634a]" : "bg-[#f3e5b7] text-[#927021]"}`}>
                <FontAwesomeIcon icon={isOnline ? faWifi : faMobileScreen} className="h-4 w-4" />
              </span>
              <div>
                <p className="font-semibold">{isOnline ? "Connexion active" : "Mode hors ligne"}</p>
                <p className="mt-0.5 text-xs text-white/60">{isOnline ? "Synchronisation disponible" : "Les scans sont conservés ici"}</p>
              </div>
            </div>
            <div className="mt-5 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/60">En attente de synchronisation</span>
                <span className="font-semibold text-[#f0ca70]">{offlineScans.length}</span>
              </div>
              {offlineScans.length > 0 && (
                <Button variant="secondary" size="sm" onClick={syncOffline} disabled={!isOnline} className="mt-4 w-full !rounded-xl !bg-[#e6b84a] !text-[#183b32] hover:!bg-[#f0ca70]">
                  <FontAwesomeIcon icon={faSync} className="mr-2 h-3 w-3" />
                  Synchroniser les scans
                </Button>
              )}
            </div>
          </section>
          <section className="rounded-[1.5rem] border border-[#e4e6dc] bg-white p-5 sm:p-6">
            <h3 className="text-sm font-semibold text-[#354c41]">Comment ça marche ?</h3>
            <ol className="mt-4 space-y-4">
              {["Saisissez le code du badge", "Vérifiez le point de contrôle", "Enregistrez le passage"].map((item, index) => (
                <li key={item} className="flex items-center gap-3 text-xs text-[#718078]">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f2f4ee] text-[11px] font-bold text-[#527963]">{index + 1}</span>
                  {item}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
    </WorkspaceShell>
  );
}

export default function ScanPage() {
  return (
    <RoleGate role="AGENT">
      <ScanWorkspace />
    </RoleGate>
  );
}
