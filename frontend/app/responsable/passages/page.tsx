"use client";

import * as React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faMagnifyingGlass, faTimeline } from "@fortawesome/free-solid-svg-icons";
import { RoleGate } from "@/components/role-gate";
import { WorkspaceShell } from "@/components/workspace-shell";
import { api, type ControlPoint, type ResponsiblePassage, type Student } from "@/lib/api";

function messageFromError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function PassagesPageContent() {
  const [students, setStudents] = React.useState<Student[]>([]);
  const [points, setPoints] = React.useState<ControlPoint[]>([]);
  const [passages, setPassages] = React.useState<ResponsiblePassage[]>([]);
  const [eleveId, setEleveId] = React.useState("");
  const [pointId, setPointId] = React.useState("");
  const [date, setDate] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState("");

  const loadPassages = React.useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setPassages(await api.listResponsiblePassages({
        eleve_id: eleveId ? Number(eleveId) : undefined,
        point_id: pointId ? Number(pointId) : undefined,
        date,
      }));
    } catch (loadError) {
      setError(messageFromError(loadError, "Impossible de charger les passages."));
    } finally {
      setIsLoading(false);
    }
  }, [date, eleveId, pointId]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void Promise.all([api.listStudents(), api.listControlPoints()])
        .then(([studentList, pointList]) => {
          setStudents(studentList);
          setPoints(pointList);
        })
        .catch((loadError: unknown) => setError(messageFromError(loadError, "Impossible de charger les filtres.")))
        .finally(() => setIsLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void loadPassages(), 0);
    return () => window.clearTimeout(timer);
  }, [loadPassages]);

  return (
    <WorkspaceShell role="RESPONSABLE">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <header className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#9a7522]">Suivi des élèves</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#183b32] sm:text-4xl">Passages</h1>
          <p className="mt-2 text-sm leading-6 text-[#718078]">Consultez les scans reçus et leur heure de synchronisation.</p>
        </header>

        {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <section className="mb-6 rounded-[1.5rem] border border-[#e4e6dc] bg-white p-5 sm:p-6">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void loadPassages();
            }}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <label className="text-xs font-semibold text-[#52655e]">
              Élève
              <select value={eleveId} onChange={(event) => setEleveId(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#dfe5da] bg-[#fcfcf9] px-3 text-sm font-normal">
                <option value="">Tous les élèves</option>
                {students.map((student) => <option key={student.id} value={student.id}>{student.nom} · {student.classe}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-[#52655e]">
              Point de contrôle
              <select value={pointId} onChange={(event) => setPointId(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#dfe5da] bg-[#fcfcf9] px-3 text-sm font-normal">
                <option value="">Tous les points</option>
                {points.map((point) => <option key={point.id} value={point.id}>{point.libelle}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-[#52655e]">
              Date du passage
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#dfe5da] bg-[#fcfcf9] px-3 text-sm font-normal" />
            </label>
            <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 self-end rounded-xl bg-[#1d4b3b] px-5 text-sm font-semibold text-white hover:bg-[#14392f]">
              <FontAwesomeIcon icon={faMagnifyingGlass} className="h-3.5 w-3.5" /> Filtrer
            </button>
          </form>
        </section>

        <section className="overflow-hidden rounded-[1.5rem] border border-[#e4e6dc] bg-white">
          <div className="flex items-center justify-between border-b border-[#edf0e9] px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8eef5] text-[#45627c]"><FontAwesomeIcon icon={faTimeline} /></span>
              <div>
                <h2 className="font-semibold text-[#183b32]">Journal des passages</h2>
                <p className="mt-1 text-xs text-[#87938b]">{isLoading ? "Chargement…" : `${passages.length} résultat(s), 500 maximum`}</p>
              </div>
            </div>
          </div>
          {isLoading ? (
            <p role="status" className="px-6 py-12 text-center text-sm text-[#718078]">Chargement des passages…</p>
          ) : passages.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-[#718078]">Aucun passage ne correspond à ces filtres.</p>
          ) : (
            <ul className="divide-y divide-[#edf0e9]">
              {passages.map((passage) => (
                <li key={passage.id} className="grid gap-3 px-5 py-4 sm:px-6 lg:grid-cols-[1.1fr_1fr_1fr_auto] lg:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#354c41]">{passage.eleve_nom}</p>
                    <p className="mt-1 text-xs text-[#87938b]">{passage.point_libelle}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#87938b]">Heure locale</p>
                    <p className="mt-1 text-sm text-[#52655e]">{formatDateTime(passage.heure_locale)}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#87938b]">Reçu serveur</p>
                    <p className="mt-1 text-sm text-[#52655e]">{formatDateTime(passage.heure_serveur)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3 lg:block lg:text-right">
                    <p className="text-xs text-[#718078]">Appareil {passage.appareil_id}</p>
                    <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                      passage.sync_etat === "RECU" ? "bg-[#eaf1e9] text-[#28634a]" : "bg-[#fff4df] text-[#956b16]"
                    }`}>
                      {passage.sync_etat === "RECU" ? "Reçu" : "Horloge suspecte"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}

export default function ResponsablePassagesPage() {
  return <RoleGate role="RESPONSABLE"><PassagesPageContent /></RoleGate>;
}
