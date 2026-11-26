"use client";

import * as React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock,
  faLocationDot,
  faPencil,
  faPlus,
  faRoute,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { RoleGate } from "@/components/role-gate";
import { WorkspaceShell } from "@/components/workspace-shell";
import {
  api,
  type AgentAccount,
  type ControlPoint,
  type ControlPointInput,
  type Student,
  type StudentRoute,
  type StudentRouteInput,
} from "@/lib/api";

const EMPTY_POINT: ControlPointInput = {
  etablissement: "",
  libelle: "",
  type: "PORTAIL",
};

function emptyRoute(studentId: number): StudentRouteInput {
  return {
    eleve_id: studentId,
    point_id: 0,
    ordre: 1,
    heure_debut: "07:00",
    heure_fin: "07:45",
    jours_application: "1111100",
  };
}

function messageFromError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function ConfigurationPageContent() {
  const [students, setStudents] = React.useState<Student[]>([]);
  const [points, setPoints] = React.useState<ControlPoint[]>([]);
  const [agents, setAgents] = React.useState<AgentAccount[]>([]);
  const [agentPointDrafts, setAgentPointDrafts] = React.useState<Record<number, number[]>>({});
  const [routes, setRoutes] = React.useState<StudentRoute[]>([]);
  const [routesStudentId, setRoutesStudentId] = React.useState("");
  const [selectedStudentId, setSelectedStudentId] = React.useState("");
  const [pointForm, setPointForm] = React.useState(EMPTY_POINT);
  const [routeForm, setRouteForm] = React.useState<StudentRouteInput>(emptyRoute(0));
  const [editingPointId, setEditingPointId] = React.useState<number | null>(null);
  const [editingRouteId, setEditingRouteId] = React.useState<number | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [savingAgentId, setSavingAgentId] = React.useState<number | null>(null);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  const loadBaseData = React.useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [studentList, pointList, agentList] = await Promise.all([
        api.listStudents(),
        api.listControlPoints(),
        api.listAgents(),
      ]);
      setStudents(studentList);
      setPoints(pointList);
      setAgents(agentList);
      setAgentPointDrafts(Object.fromEntries(
        agentList.map((agent) => [agent.id, agent.point_controle_ids])
      ));
      setSelectedStudentId((current) => current || String(studentList[0]?.id ?? ""));
    } catch (loadError) {
      setError(messageFromError(loadError, "Impossible de charger la configuration."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void loadBaseData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadBaseData]);

  React.useEffect(() => {
    if (!selectedStudentId) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void api.listStudentRoutes(Number(selectedStudentId))
        .then((list) => {
          if (active) {
            setRoutes(list);
            setRoutesStudentId(selectedStudentId);
          }
        })
        .catch((loadError: unknown) => {
          if (active) setError(messageFromError(loadError, "Impossible de charger l’itinéraire."));
        });
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [selectedStudentId]);

  const resetPointForm = () => {
    setEditingPointId(null);
    setPointForm(EMPTY_POINT);
  };

  const resetRouteForm = () => {
    setEditingRouteId(null);
    setRouteForm(emptyRoute(Number(selectedStudentId) || 0));
  };

  const saveAgentPoints = async (agent: AgentAccount) => {
    setSavingAgentId(agent.id);
    setError("");
    setSuccess("");
    try {
      const selectedPointIds = agentPointDrafts[agent.id] ?? agent.point_controle_ids;
      const updated = await api.assignAgentControlPoints(
        agent.id,
        selectedPointIds,
      );
      setAgents((current) => current.map((item) =>
        item.id === updated.id ? updated : item
      ));
      setAgentPointDrafts((current) => ({
        ...current,
        [updated.id]: updated.point_controle_ids,
      }));
      setSuccess(
        updated.point_controle_ids.length > 0
          ? `${updated.point_controle_ids.length} point(s) affecté(s) à ${updated.nom}.`
          : `Aucun point n’est affecté à ${updated.nom}.`
      );
    } catch (saveError) {
      setError(messageFromError(saveError, "Impossible d’affecter ces points à l’agent."));
    } finally {
      setSavingAgentId(null);
    }
  };

  const savePoint = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      if (editingPointId !== null) {
        const updated = await api.updateControlPoint(editingPointId, pointForm);
        setPoints((current) => current.map((point) => point.id === updated.id ? updated : point));
        setSuccess(`Le point « ${updated.libelle} » a été modifié.`);
      } else {
        const created = await api.createControlPoint(pointForm);
        setPoints((current) => [...current, created].sort((a, b) =>
          `${a.etablissement} ${a.libelle}`.localeCompare(`${b.etablissement} ${b.libelle}`, "fr")
        ));
        setSuccess(`Le point « ${created.libelle} » a été créé.`);
      }
      resetPointForm();
    } catch (saveError) {
      setError(messageFromError(saveError, "Impossible d’enregistrer ce point."));
    } finally {
      setBusy(false);
    }
  };

  const saveRoute = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const saved = editingRouteId === null
        ? await api.createStudentRoute(routeForm)
        : await api.updateStudentRoute(editingRouteId, routeForm);
      setRoutes((current) => [
        ...current.filter((route) => route.id !== saved.id),
        saved,
      ].sort((a, b) => a.ordre - b.ordre));
      setSuccess(`L’itinéraire de ${saved.eleve_nom} a été enregistré.`);
      resetRouteForm();
    } catch (saveError) {
      setError(messageFromError(saveError, "Impossible d’enregistrer cet itinéraire."));
    } finally {
      setBusy(false);
    }
  };

  const selectedStudent = students.find((student) => String(student.id) === selectedStudentId);
  const visibleRoutes = routesStudentId === selectedStudentId ? routes : [];
  const studentPoints = points.filter((point) =>
    !selectedStudent || point.etablissement === selectedStudent.etablissement
  );

  return (
    <WorkspaceShell role="RESPONSABLE">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <header className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#9a7522]">
            Configuration de l’établissement
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#183b32] sm:text-4xl">
            Points et itinéraires
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#718078]">
            Configurez les lieux de passage et les horaires attendus pour chaque élève.
          </p>
        </header>

        {(error || success) && (
          <div
            role={error ? "alert" : "status"}
            className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
              error
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-[#d2e3d5] bg-[#edf5ee] text-[#28634a]"
            }`}
          >
            {error || success}
          </div>
        )}

        {isLoading ? (
          <p role="status" className="rounded-2xl border border-[#e4e6dc] bg-white p-8 text-center text-sm text-[#718078]">
            Chargement de la configuration…
          </p>
        ) : (
          <div className="space-y-6">
            <section className="overflow-hidden rounded-[1.5rem] border border-[#e4e6dc] bg-white">
              <div className="border-b border-[#edf0e9] px-5 py-5 sm:px-6">
                <h2 className="font-semibold text-[#183b32]">Affectation des Agents</h2>
                <p className="mt-1 text-xs text-[#87938b]">
                  Affectez un ou plusieurs points autorisés à chaque compte Agent, quel que soit l’appareil utilisé.
                </p>
              </div>
              {agents.length === 0 ? (
                <p className="px-5 py-6 text-sm text-[#718078]">
                  Aucun compte Agent à configurer.
                </p>
              ) : (
                <ul className="divide-y divide-[#edf0e9]">
                  {agents.map((agent) => (
                    <li
                      key={agent.id}
                      className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[#354c41]">{agent.nom}</p>
                        <p className="mt-1 text-xs text-[#87938b]">{agent.identifiant}</p>
                      </div>
                      <div className="w-full sm:max-w-sm">
                        <p className="mb-2 text-xs font-semibold text-[#52655e]">
                          Points affectés
                        </p>
                        {points.length === 0 ? (
                          <p className="text-xs text-[#87938b]">Créez d’abord un point de contrôle.</p>
                        ) : (
                          <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border border-[#dfe5da] bg-[#fcfcf9] p-2">
                            {points.map((point) => {
                              const selected = (
                                agentPointDrafts[agent.id] ?? agent.point_controle_ids
                              ).includes(point.id);
                              return (
                                <label
                                  key={point.id}
                                  className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-[#354c41] hover:bg-white"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selected}
                                    disabled={savingAgentId !== null}
                                    onChange={(event) => {
                                      const current = agentPointDrafts[agent.id]
                                        ?? agent.point_controle_ids;
                                      const next = event.target.checked
                                        ? [...current, point.id]
                                        : current.filter((id) => id !== point.id);
                                      setAgentPointDrafts((drafts) => ({
                                        ...drafts,
                                        [agent.id]: next,
                                      }));
                                    }}
                                    className="h-4 w-4 accent-[#28634a]"
                                  />
                                  <span>{point.libelle} · {point.etablissement}</span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                        <Button
                          type="button"
                          isLoading={savingAgentId === agent.id}
                          disabled={savingAgentId !== null || points.length === 0}
                          onClick={() => void saveAgentPoints(agent)}
                          className="mt-2 min-h-10 w-full !rounded-lg !bg-[#1d4b3b] text-sm hover:!bg-[#14392f]"
                        >
                          Enregistrer les points
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

          <div className="grid items-start gap-6 xl:grid-cols-2">
            <section className="overflow-hidden rounded-[1.5rem] border border-[#e4e6dc] bg-white">
              <div className="border-b border-[#edf0e9] px-5 py-5 sm:px-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf1e9] text-[#28634a]">
                    <FontAwesomeIcon icon={faLocationDot} className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="font-semibold text-[#183b32]">Points de contrôle</h2>
                    <p className="mt-1 text-xs text-[#87938b]">{points.length} point(s) configuré(s)</p>
                  </div>
                </div>
              </div>

              {points.length === 0 ? (
                <p className="px-5 py-6 text-sm text-[#718078]">Aucun point. Créez le premier ci-dessous.</p>
              ) : (
                <ul className="divide-y divide-[#edf0e9]">
                  {points.map((point) => (
                    <li key={point.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#354c41]">{point.libelle}</p>
                        <p className="mt-1 truncate text-xs text-[#87938b]">{point.etablissement}</p>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-end">
                        <Badge variant={point.type === "PORTAIL" ? "info" : "warning"}>
                          {point.type === "PORTAIL" ? "Portail" : "Autobus"}
                        </Badge>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="min-h-11 !rounded-lg !border-[#dfe5da] !text-[#52655e] sm:min-h-0"
                          onClick={() => {
                            setEditingPointId(point.id);
                            setPointForm({
                              etablissement: point.etablissement,
                              libelle: point.libelle,
                              type: point.type,
                            });
                          }}
                        >
                          <FontAwesomeIcon icon={faPencil} className="mr-2 h-3 w-3" />
                          Modifier
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              <form onSubmit={savePoint} className="space-y-4 border-t border-[#edf0e9] bg-[#fcfcf9] p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-[#183b32]">
                    {editingPointId === null ? "Créer un point" : "Modifier le point"}
                  </h3>
                  {editingPointId !== null && (
                    <button type="button" onClick={resetPointForm} aria-label="Annuler la modification du point" className="flex h-9 w-9 items-center justify-center rounded-lg text-[#718078] hover:bg-[#edf0e9]">
                      <FontAwesomeIcon icon={faXmark} />
                    </button>
                  )}
                </div>
                <label className="block text-xs font-semibold text-[#52655e]">
                  Établissement
                  <input
                    required
                    maxLength={120}
                    value={pointForm.etablissement}
                    onChange={(event) => setPointForm({ ...pointForm, etablissement: event.target.value })}
                    className="mt-1.5 w-full rounded-xl border border-[#dfe5da] bg-white px-3.5 py-3 text-sm font-normal text-[#354c41] outline-none focus:border-[#527963] focus:ring-4 focus:ring-[#527963]/10"
                  />
                </label>
                <label className="block text-xs font-semibold text-[#52655e]">
                  Libellé
                  <input
                    required
                    maxLength={120}
                    value={pointForm.libelle}
                    onChange={(event) => setPointForm({ ...pointForm, libelle: event.target.value })}
                    placeholder="Ex. : Portail entrée"
                    className="mt-1.5 w-full rounded-xl border border-[#dfe5da] bg-white px-3.5 py-3 text-sm font-normal text-[#354c41] outline-none focus:border-[#527963] focus:ring-4 focus:ring-[#527963]/10"
                  />
                </label>
                <label className="block text-xs font-semibold text-[#52655e]">
                  Type
                  <select
                    value={pointForm.type}
                    onChange={(event) => setPointForm({
                      ...pointForm,
                      type: event.target.value as ControlPointInput["type"],
                    })}
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-[#dfe5da] bg-white px-3.5 text-sm font-normal text-[#354c41] outline-none focus:border-[#527963] focus:ring-4 focus:ring-[#527963]/10"
                  >
                    <option value="PORTAIL">Portail</option>
                    <option value="AUTOBUS">Autobus</option>
                  </select>
                </label>
                <Button type="submit" isLoading={busy} className="min-h-11 w-full !rounded-xl !bg-[#1d4b3b] text-sm hover:!bg-[#14392f]">
                  <FontAwesomeIcon icon={faPlus} className="mr-2 h-3.5 w-3.5" />
                  {editingPointId === null ? "Créer le point" : "Enregistrer"}
                </Button>
              </form>
            </section>

            <section className="overflow-hidden rounded-[1.5rem] border border-[#e4e6dc] bg-white">
              <div className="border-b border-[#edf0e9] px-5 py-5 sm:px-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff4df] text-[#956b16]">
                    <FontAwesomeIcon icon={faRoute} className="h-4 w-4" />
                  </span>
                  <div>
                    <h2 className="font-semibold text-[#183b32]">Itinéraire d’un élève</h2>
                    <p className="mt-1 text-xs text-[#87938b]">Ordre des points, horaires et jours de passage.</p>
                  </div>
                </div>
              </div>

              <div className="border-b border-[#edf0e9] p-5 sm:px-6">
                <label className="block text-xs font-semibold text-[#52655e]">
                  Élève
                  <select
                    value={selectedStudentId}
                    onChange={(event) => {
                      const nextStudentId = event.target.value;
                      setSelectedStudentId(nextStudentId);
                      setEditingRouteId(null);
                      const student = students.find((item) => String(item.id) === nextStudentId);
                      const firstPoint = points.find((point) => point.etablissement === student?.etablissement);
                      setRouteForm({
                        ...emptyRoute(Number(nextStudentId) || 0),
                        point_id: firstPoint?.id ?? 0,
                      });
                    }}
                    className="mt-1.5 min-h-11 w-full rounded-xl border border-[#dfe5da] bg-[#fcfcf9] px-3.5 text-sm font-normal text-[#354c41] outline-none focus:border-[#527963] focus:ring-4 focus:ring-[#527963]/10"
                  >
                    {students.length === 0 && <option value="">Aucun élève disponible</option>}
                    {students.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.nom} · {student.classe}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {selectedStudentId && visibleRoutes.length > 0 ? (
                <ol className="divide-y divide-[#edf0e9]">
                  {visibleRoutes.map((route) => (
                    <li key={route.id} className="flex items-start gap-3 px-5 py-4 sm:px-6">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eaf1e9] text-sm font-bold text-[#28634a]">
                        {route.ordre}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#354c41]">{route.point_libelle}</p>
                        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#87938b]">
                          <span className="inline-flex items-center gap-1"><FontAwesomeIcon icon={faClock} /> {route.heure_debut}–{route.heure_fin}</span>
                          <span>{route.jours_application.split("").map((jour, index) => jour === "1" ? ["L", "M", "M", "J", "V", "S", "D"][index] : "").join(" ")}</span>
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11 shrink-0 !rounded-lg !border-[#dfe5da] !text-[#52655e] sm:min-h-0"
                        onClick={() => {
                          setEditingRouteId(route.id);
                          setRouteForm({
                            eleve_id: route.eleve_id,
                            point_id: route.point_id,
                            ordre: route.ordre,
                            heure_debut: route.heure_debut.slice(0, 5),
                            heure_fin: route.heure_fin.slice(0, 5),
                            jours_application: route.jours_application,
                          });
                        }}
                      >
                        <FontAwesomeIcon icon={faPencil} className="sm:mr-2" />
                        <span className="hidden sm:inline">Modifier</span>
                      </Button>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="px-5 py-6 text-sm text-[#718078] sm:px-6">
                  {selectedStudentId
                    ? routesStudentId !== selectedStudentId
                      ? "Chargement de l’itinéraire…"
                      : "Aucun point configuré pour cet élève."
                    : "Créez un élève pour définir son itinéraire."}
                </p>
              )}

              <form onSubmit={saveRoute} className="space-y-4 border-t border-[#edf0e9] bg-[#fcfcf9] p-5 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold text-[#183b32]">
                    {editingRouteId === null ? "Ajouter un point à l’itinéraire" : "Modifier l’horaire"}
                  </h3>
                  {editingRouteId !== null && (
                    <button type="button" onClick={resetRouteForm} aria-label="Annuler la modification de l’itinéraire" className="flex h-9 w-9 items-center justify-center rounded-lg text-[#718078] hover:bg-[#edf0e9]">
                      <FontAwesomeIcon icon={faXmark} />
                    </button>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs font-semibold text-[#52655e]">
                    Point
                    <select
                      required
                      value={routeForm.point_id || ""}
                      onChange={(event) => setRouteForm({ ...routeForm, point_id: Number(event.target.value) })}
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-[#dfe5da] bg-white px-3 text-sm font-normal text-[#354c41]"
                    >
                      <option value="" disabled>Choisir un point</option>
                      {studentPoints.map((point) => (
                        <option key={point.id} value={point.id}>{point.libelle} · {point.type}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-[#52655e]">
                    Ordre
                    <input
                      type="number"
                      min={1}
                      max={32767}
                      required
                      value={routeForm.ordre}
                      onChange={(event) => setRouteForm({ ...routeForm, ordre: Number(event.target.value) })}
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-[#dfe5da] bg-white px-3 text-sm font-normal text-[#354c41]"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-[#52655e]">
                    Heure de début
                    <input
                      type="time"
                      required
                      value={routeForm.heure_debut}
                      onChange={(event) => setRouteForm({ ...routeForm, heure_debut: event.target.value })}
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-[#dfe5da] bg-white px-3 text-sm font-normal text-[#354c41]"
                    />
                  </label>
                  <label className="block text-xs font-semibold text-[#52655e]">
                    Heure de fin
                    <input
                      type="time"
                      required
                      value={routeForm.heure_fin}
                      onChange={(event) => setRouteForm({ ...routeForm, heure_fin: event.target.value })}
                      className="mt-1.5 min-h-11 w-full rounded-xl border border-[#dfe5da] bg-white px-3 text-sm font-normal text-[#354c41]"
                    />
                  </label>
                </div>
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold text-[#52655e]">Jours d’application</legend>
                  <div className="grid grid-cols-7 gap-1.5">
                    {["L", "Ma", "Me", "J", "V", "S", "D"].map((label, index) => {
                      const enabled = routeForm.jours_application[index] === "1";
                      return (
                        <label key={`${label}-${index}`} className={`flex min-h-11 cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold ${
                          enabled ? "border-[#527963] bg-[#eaf1e9] text-[#28634a]" : "border-[#dfe5da] bg-white text-[#87938b]"
                        }`}>
                          <input
                            type="checkbox"
                            checked={enabled}
                            onChange={(event) => {
                              const days = routeForm.jours_application.split("");
                              days[index] = event.target.checked ? "1" : "0";
                              setRouteForm({ ...routeForm, jours_application: days.join("") });
                            }}
                            className="sr-only"
                          />
                          {label}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
                <Button
                  type="submit"
                  isLoading={busy}
                  disabled={!selectedStudentId || studentPoints.length === 0}
                  className="min-h-11 w-full !rounded-xl !bg-[#1d4b3b] text-sm hover:!bg-[#14392f]"
                >
                  <FontAwesomeIcon icon={editingRouteId === null ? faPlus : faPencil} className="mr-2 h-3.5 w-3.5" />
                  {editingRouteId === null ? "Ajouter à l’itinéraire" : "Enregistrer l’itinéraire"}
                </Button>
              </form>
            </section>
          </div>
          </div>
        )}
      </div>
    </WorkspaceShell>
  );
}

export default function ResponsableConfigurationPage() {
  return (
    <RoleGate role="RESPONSABLE">
      <ConfigurationPageContent />
    </RoleGate>
  );
}
