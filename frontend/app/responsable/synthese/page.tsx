"use client";

import * as React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChartColumn, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/button";
import { RoleGate } from "@/components/role-gate";
import { WorkspaceShell } from "@/components/workspace-shell";
import { api, type DailySummary, type Student } from "@/lib/api";

const METRIC_LABELS: Record<string, string> = {
  classe: "Classe",
  date: "Date",
  total_eleves: "Élèves inscrits",
  eleves_presents: "Présents",
  eleves_absents: "Absents",
  retards_portail: "Retards au portail",
  doubles_scans: "Doubles scans",
  sorties_hors_plage: "Passages hors plage",
  anomalies_horloge: "Horloges suspectes",
};

function messageFromError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function SummaryPageContent() {
  const [students, setStudents] = React.useState<Student[]>([]);
  const [classe, setClasse] = React.useState("");
  const [date, setDate] = React.useState("");
  const [summary, setSummary] = React.useState<DailySummary | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void api.listStudents()
        .then((list) => {
          setStudents(list);
          const firstClass = Array.from(new Set(list.map((student) => student.classe))).sort((a, b) => a.localeCompare(b, "fr"))[0];
          setClasse(firstClass ?? "");
        })
        .catch((loadError: unknown) => setError(messageFromError(loadError, "Impossible de charger les classes.")))
        .finally(() => setIsLoading(false));
      const now = new Date();
      const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
      setDate(localDate);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const classes = Array.from(new Set(students.map((student) => student.classe))).sort((a, b) => a.localeCompare(b, "fr"));

  const generate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsGenerating(true);
    setError("");
    setSummary(null);
    try {
      setSummary(await api.generateDailySummary(classe, date));
    } catch (generateError) {
      setError(messageFromError(generateError, "Impossible de générer la synthèse."));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <WorkspaceShell role="RESPONSABLE">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
        <header className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#9a7522]">Analyse de la journée</p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#183b32] sm:text-4xl">Synthèse quotidienne</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#718078]">
            Les chiffres sont calculés à partir des passages et anomalies enregistrés. Le texte est produit par le modèle, ou par le gabarit en mode dégradé.
          </p>
        </header>

        {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <section className="rounded-[1.5rem] border border-[#e4e6dc] bg-white p-5 sm:p-7">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eaf1e9] text-[#28634a]"><FontAwesomeIcon icon={faChartColumn} /></span>
            <div>
              <h2 className="font-semibold text-[#183b32]">Paramètres de la synthèse</h2>
              <p className="mt-1 text-xs text-[#87938b]">Choisissez une classe et une date.</p>
            </div>
          </div>
          {isLoading ? (
            <p role="status" className="text-sm text-[#718078]">Chargement des classes…</p>
          ) : (
            <form onSubmit={generate} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="text-xs font-semibold text-[#52655e]">
                Classe
                <select required value={classe} onChange={(event) => setClasse(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#dfe5da] bg-[#fcfcf9] px-3 text-sm font-normal">
                  {classes.length === 0 && <option value="">Aucune classe disponible</option>}
                  {classes.map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label className="text-xs font-semibold text-[#52655e]">
                Date
                <input required type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[#dfe5da] bg-[#fcfcf9] px-3 text-sm font-normal" />
              </label>
              <Button type="submit" isLoading={isGenerating} disabled={!classe || !date} className="min-h-11 w-full !rounded-xl !bg-[#1d4b3b] text-sm hover:!bg-[#14392f] sm:w-auto">
                <FontAwesomeIcon icon={faWandMagicSparkles} className="mr-2 h-3.5 w-3.5" />
                Générer
              </Button>
            </form>
          )}
        </section>

        {summary && (
          <section aria-live="polite" className="mt-6 overflow-hidden rounded-[1.5rem] border border-[#dfe5da] bg-white">
            <div className="flex flex-col gap-3 border-b border-[#edf0e9] bg-[#fcfcf9] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9a7522]">{summary.classe} · {summary.date}</p>
                <h2 className="mt-1 text-lg font-semibold text-[#183b32]">Résultats de la journée</h2>
              </div>
              <span className={`inline-flex w-fit items-center rounded-full px-3 py-1.5 text-xs font-semibold ${
                summary.origine === "MODELE" ? "bg-[#e8eef5] text-[#45627c]" : "bg-[#fff4df] text-[#956b16]"
              }`}>
                {summary.origine === "MODELE" ? "Texte reformulé par le modèle" : "Texte issu du gabarit"}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-3 sm:p-7 lg:grid-cols-4">
              {Object.entries(summary.chiffres)
                .filter(([key]) => key !== "classe" && key !== "date")
                .map(([key, value]) => (
                  <article key={key} className="rounded-xl border border-[#edf0e9] bg-[#fcfcf9] p-4">
                    <p className="text-xs leading-5 text-[#87938b]">{METRIC_LABELS[key] ?? key}</p>
                    <p className="mt-1 text-2xl font-semibold tracking-tight text-[#183b32]">{value}</p>
                  </article>
                ))}
            </div>
            <div className="border-t border-[#edf0e9] px-5 py-5 sm:px-7">
              <h3 className="text-sm font-semibold text-[#183b32]">Synthèse</h3>
              <p className="mt-2 text-sm leading-7 text-[#52655e]">{summary.texte}</p>
            </div>
          </section>
        )}
      </div>
    </WorkspaceShell>
  );
}

export default function ResponsableSummaryPage() {
  return <RoleGate role="RESPONSABLE"><SummaryPageContent /></RoleGate>;
}
