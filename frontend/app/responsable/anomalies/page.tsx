"use client";

import * as React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell, faCheck, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { RoleGate } from "@/components/role-gate";
import { WorkspaceShell } from "@/components/workspace-shell";
import {
  api,
  type AnomalyType,
  type ResponsibleAnomaly,
  type Student,
} from "@/lib/api";

const ANOMALY_LABELS: Record<AnomalyType, string> = {
  ABSENCE: "Absence",
  HORS_FENETRE: "Hors plage horaire",
  POINT_INATTENDU: "Point inattendu",
  DOUBLE_SCAN: "Double scan",
  HORLOGE_SUSPECTE: "Horloge suspecte",
};

function messageFromError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function AnomaliesPageContent() {
  const [students, setStudents] = React.useState<Student[]>([]);
  const [anomalies, setAnomalies] = React.useState<ResponsibleAnomaly[]>([]);
  const [eleveId, setEleveId] = React.useState("");
  const [type, setType] = React.useState<AnomalyType | "">("");
  const [date, setDate] = React.useState("");
  const [traite, setTraite] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  const loadAnomalies = React.useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setAnomalies(await api.listResponsibleAnomalies({
        eleve_id: eleveId ? Number(eleveId) : undefined,
        type,
        date,
        traite: traite === "" ? undefined : traite === "true",
      }));
    } catch (loadError) {
      setError(messageFromError(loadError, "Impossible de charger les anomalies."));
    } finally {
      setIsLoading(false);
    }
  }, [date, eleveId, traite, type]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void api.listStudents()
        .then(setStudents)
        .catch((loadError: unknown) => setError(messageFromError(loadError, "Impossible de charger les élèves.")));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void loadAnomalies(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAnomalies]);

  const markTreated = async (anomaly: ResponsibleAnomaly) => {
    setBusyId(anomaly.id);
    setError("");
    setSuccess("");
    try {
      const updated = await api.markAnomalyTreated(anomaly.id, true);
      setAnomalies((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSuccess(`L’anomalie « ${ANOMALY_LABELS[anomaly.type]} » de ${anomaly.eleve_nom} est traitée.`);
    } catch (updateError) {
      setError(messageFromError(updateError, "Impossible de marquer cette anomalie comme traitée."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <WorkspaceShell role="RESPONSABLE">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <header className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#9a7522]">Surveillance des passages</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#183b32] sm:text-4xl">Anomalies</h1>
          <p className="mt-2 text-sm leading-6 text-[#718078]">Examinez les écarts détectés et marquez les cas pris en charge.</p>
        </header>

        {(error || success) && (
          <p role={error ? "alert" : "status"} className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
            error ? "border-red-200 bg-red-50 text-red-700" : "border-[#d2e3d5] bg-[#edf5ee] text-[#28634a]"
          }`}>{error || success}</p>
        )}

        <section className="mb-6 rounded-[1.5rem] border border-[#e4e6dc] bg-white p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff4df] text-[#956b16]"><FontAwesomeIcon icon={faMagnifyingGlass} /></span>
            <div>
              <h2 className="font-semibold text-[#183b32]">Filtrer les anomalies</h2>
              <p className="mt-1 text-xs text-[#87938b]">Les filtres sont appliqués automatiquement.</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-semibold text-[#52655e]">
              Élève
              <select value={eleveId} onChange={(event) => setEleveId(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#dfe5da] bg-[#fcfcf9] px-3 text-sm font-normal">
                <option value="">Tous les élèves</option>
                {students.map((student) => <option key={student.id} value={student.id}>{student.nom}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-[#52655e]">
              Type
              <select value={type} onChange={(event) => setType(event.target.value as AnomalyType | "")} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#dfe5da] bg-[#fcfcf9] px-3 text-sm font-normal">
                <option value="">Tous les types</option>
                {Object.entries(ANOMALY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-xs font-semibold text-[#52655e]">
              Date
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#dfe5da] bg-[#fcfcf9] px-3 text-sm font-normal" />
            </label>
            <label className="text-xs font-semibold text-[#52655e]">
              Traitement
              <select value={traite} onChange={(event) => setTraite(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#dfe5da] bg-[#fcfcf9] px-3 text-sm font-normal">
                <option value="">Tous les états</option>
                <option value="false">À traiter</option>
                <option value="true">Traitées</option>
              </select>
            </label>
          </div>
        </section>

        <section className="overflow-hidden rounded-[1.5rem] border border-[#e4e6dc] bg-white">
          <div className="flex items-center gap-3 border-b border-[#edf0e9] px-5 py-4 sm:px-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f8ece8] text-[#a54c36]"><FontAwesomeIcon icon={faBell} /></span>
            <div>
              <h2 className="font-semibold text-[#183b32]">Anomalies détectées</h2>
              <p className="mt-1 text-xs text-[#87938b]">{isLoading ? "Chargement…" : `${anomalies.length} résultat(s), 500 maximum`}</p>
            </div>
          </div>
          {isLoading ? (
            <p role="status" className="px-6 py-12 text-center text-sm text-[#718078]">Chargement des anomalies…</p>
          ) : anomalies.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-[#718078]">Aucune anomalie ne correspond à ces filtres.</p>
          ) : (
            <ul className="divide-y divide-[#edf0e9]">
              {anomalies.map((anomaly) => (
                <li key={anomaly.id} className="flex flex-col gap-4 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#354c41]">{anomaly.eleve_nom}</p>
                      <Badge variant={anomaly.traite ? "success" : "warning"}>{anomaly.traite ? "Traitée" : "À traiter"}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-[#52655e]">{ANOMALY_LABELS[anomaly.type]}</p>
                    <p className="mt-1 text-xs text-[#87938b]">
                      {new Date(`${anomaly.date}T12:00:00`).toLocaleDateString("fr-FR", { dateStyle: "long" })}
                      {anomaly.passage_point ? ` · ${anomaly.passage_point}` : " · Aucun passage associé"}
                    </p>
                  </div>
                  {!anomaly.traite && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      isLoading={busyId === anomaly.id}
                      disabled={busyId !== null}
                      onClick={() => void markTreated(anomaly)}
                      className="min-h-11 w-full !rounded-lg !border-[#dfe5da] !text-[#28634a] sm:w-auto"
                    >
                      <FontAwesomeIcon icon={faCheck} className="mr-2 h-3 w-3" />
                      Marquer comme traitée
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}

export default function ResponsableAnomaliesPage() {
  return <RoleGate role="RESPONSABLE"><AnomaliesPageContent /></RoleGate>;
}
