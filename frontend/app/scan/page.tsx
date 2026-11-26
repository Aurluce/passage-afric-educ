"use client";

import * as React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock,
  faDatabase,
  faSync,
  faCamera,
  faTriangleExclamation,
  faWifi,
} from "@fortawesome/free-solid-svg-icons";
import { BrowserQRCodeReader } from "@zxing/browser";
import { Button } from "@/components/button";
import { RoleGate } from "@/components/role-gate";
import { WorkspaceShell } from "@/components/workspace-shell";
import {
  chargerScans,
  isPassageScan,
  remplacerScans,
  type PassageScan,
} from "@/lib/offline-scan-store";

const API_BASE = "/api";
const STORAGE_KEY = "passage_offline_scans";
const APPAREIL_ID = "dev-agent-01";

interface PointItem {
  id: number;
  libelle: string;
  etablissement: string;
  type: "PORTAIL" | "AUTOBUS";
}

interface BadgeQrPayload {
  badge_id: number;
  code: string;
}

function parseBadgeQr(value: string): BadgeQrPayload | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    const payload = parsed as Record<string, unknown>;
    if (
      typeof payload.badge_id !== "number" ||
      !Number.isInteger(payload.badge_id) ||
      typeof payload.code !== "string"
    ) {
      return null;
    }
    return { badge_id: payload.badge_id, code: payload.code };
  } catch {
    return null;
  }
}

function ScanWorkspace() {
  const [points, setPoints] = React.useState<PointItem[]>([]);
  const [pointId, setPointId] = React.useState<string>("");
  const [manualCode, setManualCode] = React.useState("");
  const [isOnline, setIsOnline] = React.useState(true);
  const [file, setFile] = React.useState<PassageScan[]>([]);
  const [queueReady, setQueueReady] = React.useState(false);
  const [rejectedScanIds, setRejectedScanIds] = React.useState<string[]>([]);
  const [cameraActive, setCameraActive] = React.useState(false);
  const [message, setMessage] = React.useState<string>("");
  const [busy, setBusy] = React.useState(false);
  const [erreurChargement, setErreurChargement] = React.useState<string>("");
  const [heureLocale, setHeureLocale] = React.useState("");
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const qrProcessingRef = React.useRef(false);
  const cameraControlsRef = React.useRef<{ stop: () => void } | null>(null);

  // Charge les points de contrôle uniquement ; l'agent ne parcourt pas le registre des élèves.
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setErreurChargement("Session absente — reconnectez-vous.");
        return;
      }
      const headers = { Authorization: `Bearer ${token}` };

      fetch(`${API_BASE}/agent/points/`, { headers })
        .then((r) => {
          if (!r.ok) throw new Error(`Points HTTP ${r.status}`);
          return r.json();
        })
        .then((p: PointItem[]) => {
          if (p.length === 0) {
            setPoints([]);
            setPointId("");
            setErreurChargement(
              "Aucun point de contrôle n’est affecté à votre compte. Contactez le Responsable."
            );
            return;
          }
          setPoints(p);
          setPointId((current) => p.some((point) => String(point.id) === current)
            ? current
            : String(p[0].id)
          );
        })
        .catch((e: unknown) => {
          const detail = e instanceof Error ? e.message : String(e);
          setErreurChargement((prev) => `${prev} | Points : ${detail}`);
        });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Charge la file IndexedDB, en migrant une fois l'ancienne file localStorage.
  React.useEffect(() => {
    let active = true;
    void (async () => {
      const saved = await chargerScans();
      const raw = localStorage.getItem(STORAGE_KEY);
      let scans = saved;

      if (raw) {
        if (saved.length === 0) {
          const legacy: unknown = JSON.parse(raw);
          if (!Array.isArray(legacy) || !legacy.every(isPassageScan)) {
            throw new Error("L'ancienne file locale contient des données invalides.");
          }
          scans = legacy;
          await remplacerScans(scans);
        }
        localStorage.removeItem(STORAGE_KEY);
      }

      if (active) {
        setFile(scans);
        setQueueReady(true);
      }
    })().catch((error: unknown) => {
      if (active) {
        const detail = error instanceof Error ? error.message : String(error);
        setErreurChargement((previous) => `${previous} | File locale : ${detail}`);
      }
    });
    const initialOnline = window.setTimeout(() => setIsOnline(navigator.onLine), 0);
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      active = false;
      window.clearTimeout(initialOnline);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const sauver = React.useCallback(async (f: PassageScan[]) => {
    await remplacerScans(f);
    setFile(f);
  }, []);

  const ajouterScan = React.useCallback(async (
    badgeId: number | null,
    code: string | null,
    codeSecours: string | null = null,
  ): Promise<boolean> => {
    if (!pointId) {
      setMessage("Aucun point de contrôle disponible.");
      return false;
    }

    const scan: PassageScan = {
      event_id_local: crypto.randomUUID(),
      badge_id: badgeId,
      badge_code: code,
      code_secours: codeSecours,
      point_id: Number(pointId),
      heure_locale: new Date().toISOString(),
    };
    const nouvelle = [...file, scan];
    try {
      await sauver(nouvelle);
      setMessage(`Scan ajouté à la file locale (${nouvelle.length} en attente).`);
      return true;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      setMessage(`Impossible d'enregistrer le scan localement : ${detail}`);
      return false;
    }
  }, [file, pointId, sauver]);

  const traiterQr = React.useCallback(async (value: string) => {
    const payload = parseBadgeQr(value);
    if (!payload || payload.code.split(":").length !== 3) {
      setMessage("QR invalide : format attendu badge_id + code signé.");
      return;
    }

    await ajouterScan(payload.badge_id, payload.code);
  }, [ajouterScan]);

  const traiterSaisieManuelle = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = manualCode.replace(/[-\s]/g, "").toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{12}$/.test(code)) {
      setMessage("Saisissez les 12 caractères du code de secours affiché avec le QR.");
      return;
    }
    const added = await ajouterScan(null, null, code);
    if (added) {
      setManualCode("");
    }
  };

  React.useEffect(() => {
    if (!cameraActive || !videoRef.current) return;
    let active = true;
    const reader = new BrowserQRCodeReader();

    void reader.decodeFromVideoDevice(undefined, videoRef.current, (result, _error, controls) => {
      if (!result || qrProcessingRef.current) return;
      qrProcessingRef.current = true;
      controls.stop();
      cameraControlsRef.current = null;
      setCameraActive(false);
      void traiterQr(result.getText()).finally(() => {
        qrProcessingRef.current = false;
      });
    }).then((controls) => {
      if (active) {
        cameraControlsRef.current = controls;
      } else {
        controls.stop();
      }
    }).catch((error: unknown) => {
      if (active) {
        setCameraActive(false);
        const detail = error instanceof Error ? error.message : String(error);
        setMessage(`Impossible d'ouvrir la caméra : ${detail}`);
      }
    });

    return () => {
      active = false;
      cameraControlsRef.current?.stop();
      cameraControlsRef.current = null;
    };
  }, [cameraActive, traiterQr]);

  React.useEffect(() => {
    const updateClock = () => {
      setHeureLocale(new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeStyle: "medium",
      }).format(new Date()));
    };
    updateClock();
    const timer = window.setInterval(updateClock, 1_000);
    return () => window.clearInterval(timer);
  }, []);

  async function synchroniser() {
    if (file.length === 0) {
      setMessage("File vide.");
      return;
    }
    setBusy(true);
    try {
      const token = localStorage.getItem("access_token");
      const r = await fetch(`${API_BASE}/passages/sync/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          appareil_id: APPAREIL_ID,
          passages: file.map((s) => ({
            event_id_local: s.event_id_local,
            badge_id: s.badge_id,
            badge_code: s.badge_code,
            code_secours: s.code_secours ?? "",
            point_id: s.point_id,
            heure_locale: s.heure_locale,
          })),
        }),
      });
      const data = await r.json();
      if (r.ok) {
        const rejectedIds = Array.isArray(data.details)
          ? data.details
            .filter((detail: { statut?: string }) =>
              ["REJETE_SIGNATURE", "REJETE_BADGE", "REJETE_POINT"].includes(detail.statut || "")
            )
            .map((detail: { event_id_local: string }) => detail.event_id_local)
          : [];
        const rejectedSignatures = data.rejected_signature ?? 0;
        if (rejectedIds.length > 0) {
          setRejectedScanIds(rejectedIds);
          await sauver(file.filter((scan) => rejectedIds.includes(scan.event_id_local)));
          setMessage(
            `Sync partielle : ${data.created} créés, ${data.ignored} ignorés, ${rejectedSignatures} QR invalide(s), expiré(s) ou déjà utilisé(s), ${data.rejected_clock} horloge(s). ${rejectedIds.length} scan(s) rejeté(s) conservé(s) dans la file.`
          );
        } else {
          setRejectedScanIds([]);
          await sauver([]);
          setMessage(
            `Sync OK : ${data.created} créés, ${data.ignored} ignorés, ${rejectedSignatures} QR invalide(s), expiré(s) ou déjà utilisé(s), ${data.rejected_clock} horloge(s).`
          );
        }
      } else {
        setMessage(`Erreur ${r.status} : ${JSON.stringify(data)}`);
      }
    } catch (e) {
      setMessage(`Hors ligne : ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <WorkspaceShell role="AGENT">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9a7522]">Espace agent</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[#183b32] sm:text-3xl">Pointage des élèves</h1>
          <p className="mt-2 text-sm text-[#718078]">Scannez les badges et synchronisez les passages.</p>
        </header>

        <section aria-label="État de l’appareil" className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <article className={`rounded-2xl border p-4 ${isOnline ? "border-[#d2e3d5] bg-white" : "border-[#f0dfc0] bg-white"}`}>
            <p className="text-xs font-medium text-[#87938b]">Connexion</p>
            <p className={`mt-1 flex items-center gap-2 text-sm font-semibold ${isOnline ? "text-[#28634a]" : "text-[#956b16]"}`}>
              <FontAwesomeIcon icon={isOnline ? faWifi : faTriangleExclamation} className="h-3.5 w-3.5" />
              {isOnline ? "En ligne" : "Hors ligne"}
            </p>
          </article>
          <article className="rounded-2xl border border-[#e4e6dc] bg-white p-4">
            <p className="text-xs font-medium text-[#87938b]">File d’attente</p>
            <p className="mt-1 text-sm font-semibold text-[#183b32]">{queueReady ? file.length : "…" } scan(s)</p>
          </article>
          <article className="col-span-2 rounded-2xl border border-[#e4e6dc] bg-white p-4 sm:col-span-1">
            <p className="text-xs font-medium text-[#87938b]">Heure de l’appareil</p>
            <p className="mt-1 flex items-center gap-2 text-sm font-semibold text-[#183b32]">
              <FontAwesomeIcon icon={faClock} className="h-3.5 w-3.5 text-[#527963]" />
              {heureLocale || "—"}
            </p>
          </article>
        </section>

        {(erreurChargement || message) && (
          <div
            role={erreurChargement ? "alert" : "status"}
            className={`mb-5 rounded-xl border px-4 py-3 text-sm leading-6 ${
              erreurChargement
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-[#dfe5da] bg-white text-[#52655e]"
            }`}
          >
            {erreurChargement || message}
          </div>
        )}

        <section aria-label="Point de contrôle autorisé" className="mb-5 rounded-[1.5rem] border border-[#e4e6dc] bg-white p-5 sm:p-6">
          <label htmlFor="agent-point" className="block text-sm font-semibold text-[#354c41]">
            Point de contrôle pour ce scan
            {points.length > 1 ? (
              <select
                id="agent-point"
                value={pointId}
                onChange={(event) => setPointId(event.target.value)}
                className="mt-2 min-h-12 w-full rounded-xl border border-[#dfe5da] bg-[#fcfcf9] px-3.5 text-sm font-normal text-[#354c41] outline-none focus:border-[#527963] focus:ring-4 focus:ring-[#527963]/10"
              >
                {points.map((point) => (
                  <option key={point.id} value={point.id}>
                    {point.libelle} · {point.etablissement}
                  </option>
                ))}
              </select>
            ) : (
              <span className="mt-2 block text-sm font-normal text-[#718078]">
                {points[0] ? `${points[0].libelle} · ${points[0].etablissement}` : "Aucun point affecté"}
              </span>
            )}
          </label>
        </section>

        <section className="mb-5 rounded-[1.5rem] border border-[#e4e6dc] bg-white p-5 sm:p-6">
          <div className="mb-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9a7522]">Pointage</p>
            <h2 className="mt-1 text-lg font-semibold text-[#183b32]">Scanner le badge</h2>
            <p className="mt-1 text-sm leading-6 text-[#718078]">
              Présentez le QR temporaire du badge devant la caméra. Le passage est d’abord conservé sur cet appareil.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              onClick={() => {
                setMessage("");
                setCameraActive((active) => !active);
              }}
              disabled={!queueReady || !pointId || busy}
              className="min-h-12 w-full !rounded-xl !bg-[#1d4b3b] text-sm hover:!bg-[#14392f]"
            >
              <FontAwesomeIcon icon={faCamera} className="mr-2 h-4 w-4" />
              {cameraActive ? "Arrêter la caméra" : "Ouvrir le scanner QR"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void synchroniser()}
              disabled={!queueReady || !isOnline || busy || file.length === 0}
              className="min-h-12 w-full !rounded-xl !border-[#dfe5da] text-sm !text-[#354c41]"
            >
              <FontAwesomeIcon icon={faSync} className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />
              {busy ? "Synchronisation…" : `Synchroniser (${file.length})`}
            </Button>
          </div>
          {cameraActive && (
            <div className="mt-4 overflow-hidden rounded-xl bg-[#183b32]">
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                aria-label="Caméra pour scanner le QR du badge"
                className="mx-auto block max-h-[60svh] w-full object-contain"
              />
              <p className="px-4 py-3 text-center text-xs text-white/80">Placez le QR au centre de l’image.</p>
            </div>
          )}
          <form onSubmit={traiterSaisieManuelle} className="mt-5 border-t border-[#edf0e9] pt-5">
            <h3 className="text-sm font-semibold text-[#354c41]">Code de secours</h3>
            <p className="mt-1 text-xs leading-5 text-[#87938b]">
              Si la caméra ne fonctionne pas, saisissez le code à usage unique affiché à côté du QR.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="text-xs font-semibold text-[#52655e]">
                Code de secours
                <input
                  type="text"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={14}
                  required
                  value={manualCode}
                  onChange={(event) => setManualCode(event.target.value.toUpperCase())}
                  placeholder="XXXX-XXXX-XXXX"
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-[#dfe5da] bg-[#fcfcf9] px-3 font-mono text-sm font-normal uppercase tracking-wider text-[#354c41] outline-none focus:border-[#527963] focus:ring-4 focus:ring-[#527963]/10"
                />
              </label>
              <Button
                type="submit"
                disabled={!queueReady || !pointId || busy}
                className="min-h-11 w-full !rounded-xl !bg-[#1d4b3b] text-sm hover:!bg-[#14392f] sm:w-auto"
              >
                Ajouter le scan
              </Button>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-[1.5rem] border border-[#e4e6dc] bg-white">
          <div className="flex items-center justify-between gap-3 border-b border-[#edf0e9] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8eef5] text-[#45627c]">
                <FontAwesomeIcon icon={faDatabase} className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-semibold text-[#183b32]">File locale</h2>
                <p className="mt-1 text-xs text-[#87938b]">{file.length} passage(s) en attente</p>
              </div>
            </div>
            {rejectedScanIds.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    await sauver(file.filter((scan) => !rejectedScanIds.includes(scan.event_id_local)));
                  } catch (error) {
                    const detail = error instanceof Error ? error.message : String(error);
                    setMessage(`Impossible de modifier la file locale : ${detail}`);
                    return;
                  }
                  setRejectedScanIds([]);
                }}
                className="!text-xs !text-[#a54c36]"
              >
                Retirer les rejets
              </Button>
            )}
          </div>
          {file.length === 0 ? (
            <p className="px-5 py-7 text-center text-sm text-[#718078]">Aucun scan en attente.</p>
          ) : (
            <details className="group">
              <summary className="min-h-12 cursor-pointer px-5 py-4 text-sm font-medium text-[#52655e] hover:bg-[#fcfcf9] sm:px-6">
                Voir les scans en attente
              </summary>
              <ul className="max-h-72 divide-y divide-[#edf0e9] overflow-y-auto border-t border-[#edf0e9]">
                {file.map((scan) => (
                  <li key={scan.event_id_local} className="flex flex-col gap-1 px-5 py-3 text-xs sm:flex-row sm:items-center sm:justify-between sm:px-6">
                    <span className="font-semibold text-[#354c41]">
                      {scan.badge_id === null ? "Code de secours" : `Badge #${scan.badge_id}`} · point #{scan.point_id}
                    </span>
                    <time className="text-[#87938b]">{new Date(scan.heure_locale).toLocaleString("fr-FR")}</time>
                    {rejectedScanIds.includes(scan.event_id_local) && (
                      <span className="font-semibold text-[#a54c36]">Rejeté : vérifiez le badge</span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
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