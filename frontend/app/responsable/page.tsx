"use client";

import * as React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMagnifyingGlass,
  faPencil,
  faPlus,
  faRotateLeft,
  faUser,
  faUserCheck,
  faUserGraduate,
  faUserSlash,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { RoleGate } from "@/components/role-gate";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/button";
import { Badge } from "@/components/badge";
import { api, type Student, type StudentInput } from "@/lib/api";

const EMPTY_FORM: StudentInput = {
  nom: "",
  classe: "",
  etablissement: "",
};

function messageFromError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function ResponsableWorkspace() {
  const [students, setStudents] = React.useState<Student[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSaving, setIsSaving] = React.useState(false);
  const [busyStudentId, setBusyStudentId] = React.useState<number | null>(null);
  const [editingStudent, setEditingStudent] = React.useState<Student | null>(null);
  const [form, setForm] = React.useState<StudentInput>(EMPTY_FORM);
  const [search, setSearch] = React.useState("");
  const [classFilter, setClassFilter] = React.useState("");
  const [schoolFilter, setSchoolFilter] = React.useState("");
  const [stateFilter, setStateFilter] = React.useState("");
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  const loadStudents = React.useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      setStudents(await api.listStudents());
    } catch (loadError) {
      setError(messageFromError(loadError, "Impossible de charger les élèves."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStudents();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadStudents]);

  const activeCount = students.filter((student) => student.etat === "ACTIF").length;
  const inactiveCount = students.length - activeCount;
  const classes = Array.from(new Set(students.map((student) => student.classe))).sort((a, b) => a.localeCompare(b, "fr"));
  const schools = Array.from(new Set(students.map((student) => student.etablissement))).sort((a, b) => a.localeCompare(b, "fr"));
  const visibleStudents = students.filter((student) =>
    `${student.nom} ${student.classe} ${student.etablissement}`.toLocaleLowerCase("fr")
      .includes(search.trim().toLocaleLowerCase("fr"))
    && (!classFilter || student.classe === classFilter)
    && (!schoolFilter || student.etablissement === schoolFilter)
    && (!stateFilter || student.etat === stateFilter)
  );

  const resetForm = () => {
    setEditingStudent(null);
    setForm(EMPTY_FORM);
  };

  const startEditing = (student: Student) => {
    setEditingStudent(student);
    setForm({
      nom: student.nom,
      classe: student.classe,
      etablissement: student.etablissement,
    });
    setError("");
    setSuccess("");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      if (editingStudent) {
        const updated = await api.updateStudent(editingStudent.id, form);
        setStudents((current) => current.map((student) =>
          student.id === updated.id ? updated : student
        ));
        setSuccess(`${updated.nom} a été modifié.`);
      } else {
        const created = await api.createStudent(form);
        setStudents((current) => [...current, created].sort((a, b) =>
          a.nom.localeCompare(b.nom, "fr")
        ));
        setSuccess(`${created.nom} a été ajouté.`);
      }
      resetForm();
    } catch (saveError) {
      setError(messageFromError(saveError, "L’enregistrement a échoué."));
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStudentState = async (student: Student) => {
    setBusyStudentId(student.id);
    setError("");
    setSuccess("");
    const nextState = student.etat === "ACTIF" ? "INACTIF" : "ACTIF";
    try {
      const updated = await api.updateStudent(student.id, { etat: nextState });
      setStudents((current) => current.map((item) =>
        item.id === updated.id ? updated : item
      ));
      setSuccess(
        nextState === "ACTIF"
          ? `${updated.nom} est de nouveau actif.`
          : `${updated.nom} a été désactivé. Son historique est conservé.`
      );
    } catch (updateError) {
      setError(messageFromError(updateError, "Impossible de modifier l’état de l’élève."));
    } finally {
      setBusyStudentId(null);
    }
  };

  return (
    <WorkspaceShell role="RESPONSABLE">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#9a7522]">
              Administration de l’établissement
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-[#183b32] sm:text-4xl">
              Gestion des élèves
            </h1>
            <p className="mt-2 text-sm text-[#718078]">
              Gérez les dossiers et l’état des élèves de votre établissement.
            </p>
          </div>
          <a
            href="#formulaire-eleve"
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#1d4b3b] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#14392f] sm:w-auto"
          >
            <FontAwesomeIcon icon={faPlus} className="h-3.5 w-3.5" />
            Ajouter un élève
          </a>
        </header>

        <section aria-label="Résumé des élèves" className="mb-6 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Élèves au total", value: students.length, icon: faUserGraduate, color: "bg-[#e8eef5] text-[#45627c]" },
            { label: "Actifs", value: activeCount, icon: faUserCheck, color: "bg-[#eaf1e9] text-[#28634a]" },
            { label: "Inactifs", value: inactiveCount, icon: faUserSlash, color: "bg-[#f2f4ee] text-[#718078]" },
          ].map((stat) => (
            <article key={stat.label} className="rounded-2xl border border-[#e4e6dc] bg-white p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-[#87938b]">{stat.label}</p>
                  <p className="mt-2 text-3xl font-semibold tracking-tight text-[#183b32]">
                    {isLoading ? "—" : stat.value}
                  </p>
                </div>
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.color}`}>
                  <FontAwesomeIcon icon={stat.icon} className="h-4 w-4" />
                </span>
              </div>
            </article>
          ))}
        </section>

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

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="overflow-hidden rounded-[1.5rem] border border-[#e4e6dc] bg-white">
            <div className="space-y-4 border-b border-[#edf0e9] px-5 py-5 sm:px-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                <h2 className="font-semibold text-[#183b32]">Liste des élèves</h2>
                <p className="mt-1 text-xs text-[#87938b]">
                  {isLoading ? "Chargement…" : `${visibleStudents.length} résultat(s)`}
                </p>
                </div>
                <label className="relative block w-full sm:max-w-xs">
                <span className="sr-only">Rechercher un élève</span>
                <FontAwesomeIcon
                  icon={faMagnifyingGlass}
                  className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#87938b]"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Nom, classe, établissement"
                  className="w-full rounded-xl border border-[#dfe5da] bg-[#fcfcf9] py-2.5 pl-10 pr-3 text-sm text-[#354c41] outline-none transition placeholder:text-[#a3ada5] focus:border-[#527963] focus:bg-white focus:ring-4 focus:ring-[#527963]/10"
                />
                </label>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <label className="sr-only" htmlFor="student-class-filter">Filtrer par classe</label>
                <select
                  id="student-class-filter"
                  value={classFilter}
                  onChange={(event) => setClassFilter(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[#dfe5da] bg-[#fcfcf9] px-3 text-sm text-[#52655e] outline-none focus:border-[#527963] focus:ring-4 focus:ring-[#527963]/10"
                >
                  <option value="">Toutes les classes</option>
                  {classes.map((classe) => <option key={classe} value={classe}>{classe}</option>)}
                </select>
                <label className="sr-only" htmlFor="student-school-filter">Filtrer par établissement</label>
                <select
                  id="student-school-filter"
                  value={schoolFilter}
                  onChange={(event) => setSchoolFilter(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[#dfe5da] bg-[#fcfcf9] px-3 text-sm text-[#52655e] outline-none focus:border-[#527963] focus:ring-4 focus:ring-[#527963]/10"
                >
                  <option value="">Tous les établissements</option>
                  {schools.map((school) => <option key={school} value={school}>{school}</option>)}
                </select>
                <label className="sr-only" htmlFor="student-state-filter">Filtrer par état</label>
                <select
                  id="student-state-filter"
                  value={stateFilter}
                  onChange={(event) => setStateFilter(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-[#dfe5da] bg-[#fcfcf9] px-3 text-sm text-[#52655e] outline-none focus:border-[#527963] focus:ring-4 focus:ring-[#527963]/10"
                >
                  <option value="">Tous les états</option>
                  <option value="ACTIF">Actifs</option>
                  <option value="INACTIF">Inactifs</option>
                </select>
              </div>
            </div>

            {isLoading ? (
              <div role="status" className="px-6 py-14 text-center text-sm text-[#718078]">
                Chargement des élèves…
              </div>
            ) : visibleStudents.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f2f4ee] text-[#718078]">
                  <FontAwesomeIcon icon={faUser} className="h-5 w-5" />
                </span>
                <p className="mt-3 text-sm font-semibold text-[#52655e]">
                  {students.length === 0 ? "Aucun élève pour le moment" : "Aucun résultat"}
                </p>
                <p className="mt-1 text-xs text-[#98a39b]">
                  {students.length === 0
                    ? "Ajoutez le premier dossier avec le formulaire."
                    : "Essayez avec un autre nom ou une autre classe."}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[#edf0e9]">
                {visibleStudents.map((student) => {
                  const isActive = student.etat === "ACTIF";
                  return (
                    <li
                      key={student.id}
                      className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f2f4ee] text-[#527963]">
                          <FontAwesomeIcon icon={faUser} className="h-4 w-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[#354c41]">{student.nom}</p>
                          <p className="mt-0.5 truncate text-xs text-[#87938b]">
                            {student.classe} · {student.etablissement}
                          </p>
                        </div>
                        <Badge variant={isActive ? "success" : "secondary"} className="shrink-0">
                          {isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(student)}
                          className="min-h-11 flex-1 !rounded-lg !text-[#52655e] hover:!bg-[#f2f4ee] sm:min-h-0 sm:flex-none"
                        >
                          <FontAwesomeIcon icon={faPencil} className="mr-2 h-3 w-3" />
                          Modifier
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busyStudentId === student.id}
                          onClick={() => void toggleStudentState(student)}
                          className="min-h-11 flex-1 whitespace-nowrap !rounded-lg !border-[#dfe5da] !text-[#52655e] sm:min-h-0 sm:flex-none"
                        >
                          <FontAwesomeIcon
                            icon={isActive ? faUserSlash : faRotateLeft}
                            className="mr-2 h-3 w-3"
                          />
                          {isActive ? "Désactiver" : "Réactiver"}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section
            id="formulaire-eleve"
            className="scroll-mt-24 rounded-[1.5rem] border border-[#e4e6dc] bg-white p-5 sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#9a7522]">
                  {editingStudent ? "Modifier le dossier" : "Nouveau dossier"}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[#183b32]">
                  {editingStudent ? editingStudent.nom : "Ajouter un élève"}
                </h2>
              </div>
              {editingStudent && (
                <button
                  type="button"
                  onClick={resetForm}
                  aria-label="Annuler la modification"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-[#718078] transition hover:bg-[#f2f4ee]"
                >
                  <FontAwesomeIcon icon={faXmark} className="h-4 w-4" />
                </button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="mt-5 space-y-4">
              <div>
                <label htmlFor="student-name" className="mb-1.5 block text-xs font-semibold text-[#52655e]">
                  Nom complet
                </label>
                <input
                  id="student-name"
                  required
                  maxLength={120}
                  value={form.nom}
                  onChange={(event) => setForm({ ...form, nom: event.target.value })}
                  placeholder="Ex. : Élève E6"
                  className="w-full rounded-xl border border-[#dfe5da] bg-[#fcfcf9] px-3.5 py-3 text-sm text-[#354c41] outline-none transition placeholder:text-[#a3ada5] focus:border-[#527963] focus:bg-white focus:ring-4 focus:ring-[#527963]/10"
                />
              </div>
              <div>
                <label htmlFor="student-class" className="mb-1.5 block text-xs font-semibold text-[#52655e]">
                  Classe
                </label>
                <input
                  id="student-class"
                  required
                  maxLength={32}
                  value={form.classe}
                  onChange={(event) => setForm({ ...form, classe: event.target.value })}
                  placeholder="Ex. : 6e A"
                  className="w-full rounded-xl border border-[#dfe5da] bg-[#fcfcf9] px-3.5 py-3 text-sm text-[#354c41] outline-none transition placeholder:text-[#a3ada5] focus:border-[#527963] focus:bg-white focus:ring-4 focus:ring-[#527963]/10"
                />
              </div>
              <div>
                <label htmlFor="student-school" className="mb-1.5 block text-xs font-semibold text-[#52655e]">
                  Établissement
                </label>
                <input
                  id="student-school"
                  required
                  maxLength={120}
                  value={form.etablissement}
                  onChange={(event) => setForm({ ...form, etablissement: event.target.value })}
                  placeholder="Nom de l’établissement"
                  className="w-full rounded-xl border border-[#dfe5da] bg-[#fcfcf9] px-3.5 py-3 text-sm text-[#354c41] outline-none transition placeholder:text-[#a3ada5] focus:border-[#527963] focus:bg-white focus:ring-4 focus:ring-[#527963]/10"
                />
              </div>
              <Button
                type="submit"
                size="md"
                isLoading={isSaving}
                className="w-full !rounded-xl !bg-[#1d4b3b] py-3 text-sm hover:!bg-[#14392f]"
              >
                <FontAwesomeIcon icon={faPlus} className="mr-2 h-3.5 w-3.5" />
                {editingStudent ? "Enregistrer les modifications" : "Créer le dossier"}
              </Button>
            </form>

            <p className="mt-4 border-t border-[#edf0e9] pt-4 text-xs leading-5 text-[#87938b]">
              La désactivation conserve le dossier et son historique. Aucun élève n’est supprimé définitivement.
            </p>
          </section>
        </div>
      </div>
    </WorkspaceShell>
  );
}

export default function ResponsablePage() {
  return (
    <RoleGate role="RESPONSABLE">
      <ResponsableWorkspace />
    </RoleGate>
  );
}
