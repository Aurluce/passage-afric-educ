"use client";

import * as React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBan,
  faCircleCheck,
  faIdCard,
  faMagnifyingGlass,
  faPause,
  faPlus,
  faQrcode,
  faRotateLeft,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { QRCodeSVG } from "qrcode.react";
import { Badge } from "@/components/badge";
import { Button } from "@/components/button";
import { RoleGate } from "@/components/role-gate";
import { WorkspaceShell } from "@/components/workspace-shell";
import {
  api,
  type BadgeState,
  type Student,
  type StudentBadge,
} from "@/lib/api";

const STATE_LABELS: Record<BadgeState, string> = {
  ACTIF: "Actif",
  SUSPENDU: "Suspendu",
  PERDU: "Perdu",
  REVOQUE: "Révoqué",
};

function messageFromError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function BadgeManagement() {
  const [students, setStudents] = React.useState<Student[]>([]);
  const [badges, setBadges] = React.useState<StudentBadge[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [pendingAction, setPendingAction] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [qrBadgeId, setQrBadgeId] = React.useState<number | null>(null);
  const [qrCode, setQrCode] = React.useState("");
  const [qrFallbackCode, setQrFallbackCode] = React.useState("");
  const [qrStatus, setQrStatus] = React.useState("");
  const [qrRefreshKey, setQrRefreshKey] = React.useState(0);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  const loadData = React.useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const [studentList, badgeList] = await Promise.all([
        api.listStudents(),
        api.listBadges(),
      ]);
      setStudents(studentList);
      setBadges(badgeList);
    } catch (loadError) {
      setError(messageFromError(loadError, "Impossible de charger les données des badges."));
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  React.useEffect(() => {
    if (qrBadgeId === null) return;
    let active = true;
    let timer: number | undefined;

    const renew = async () => {
      try {
        const result = await api.generateBadgeQrCode(qrBadgeId);
        if (!active) return;
        setQrCode(result.code);
        setQrFallbackCode(result.code_secours);
        setQrStatus(`QR renouvelé automatiquement. Validité : ${result.expire_dans} s.`);
        timer = window.setTimeout(
          () => void renew(),
          Math.max(5_000, (result.expire_dans - 30) * 1_000)
        );
      } catch (qrError) {
        if (!active) return;
        setQrCode("");
        setQrFallbackCode("");
        setQrStatus(messageFromError(qrError, "Impossible de renouveler le QR."));
        timer = window.setTimeout(() => void renew(), 15_000);
      }
    };

    void renew();
    return () => {
      active = false;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [qrBadgeId, qrRefreshKey]);

  const studentsWithBadges = new Set(badges.map((badge) => badge.eleve_id));
  const replacedBadgeIds = new Set(
    badges.flatMap((badge) => badge.badge_remplace === null ? [] : [badge.badge_remplace])
  );
  const studentsWithoutBadges = students.filter((student) =>
    student.etat === "ACTIF" && !studentsWithBadges.has(student.id)
  );
  const visibleBadges = badges.filter((badge) =>
    `${badge.eleve_nom} ${STATE_LABELS[badge.etat]}`
      .toLocaleLowerCase("fr")
      .includes(search.trim().toLocaleLowerCase("fr"))
  );
  const activeCount = badges.filter((badge) => badge.etat === "ACTIF").length;
  const suspendedCount = badges.filter((badge) => badge.etat === "SUSPENDU").length;
  const attentionCount = badges.filter((badge) =>
    badge.etat === "PERDU" || badge.etat === "REVOQUE"
  ).length;

  const issueBadge = async (student: Student) => {
    setPendingAction(`student-${student.id}`);
    setError("");
    setSuccess("");
    try {
      const created = await api.issueBadge(student.id);
      setBadges((current) => [created, ...current]);
      setSuccess(`Le badge de ${student.nom} a été émis.`);
    } catch (issueError) {
      setError(messageFromError(issueError, "Impossible d’émettre le badge."));
    } finally {
      setPendingAction(null);
    }
  };

  const changeBadgeState = async (badge: StudentBadge, etat: BadgeState) => {
    setPendingAction(`badge-${badge.id}`);
    setError("");
    setSuccess("");
    try {
      if (qrBadgeId === badge.id && etat !== "ACTIF") {
        setQrBadgeId(null);
        setQrCode("");
      }
      const updated = await api.updateBadgeState(badge.id, etat);
      setBadges((current) => current.map((item) =>
        item.id === updated.id ? updated : item
      ));
      setSuccess(`Le badge de ${badge.eleve_nom} est maintenant ${STATE_LABELS[etat].toLocaleLowerCase("fr")}.`);
    } catch (updateError) {
      setError(messageFromError(updateError, "Impossible de modifier l’état du badge."));
    } finally {
      setPendingAction(null);
    }
  };

  const reissueBadge = async (badge: StudentBadge) => {
    setPendingAction(`badge-${badge.id}`);
    setError("");
    setSuccess("");
    try {
      if (qrBadgeId === badge.id) {
        setQrBadgeId(null);
        setQrCode("");
      }
      const created = await api.reissueBadge(badge.id);
      setBadges((current) => [
        created,
        ...current.map((item) =>
          item.id === badge.id ? { ...item, etat: "REVOQUE" as const } : item
        ),
      ]);
      setSuccess(`Un nouveau badge a été émis pour ${badge.eleve_nom}. L’ancien est révoqué.`);
    } catch (reissueError) {
      setError(messageFromError(reissueError, "Impossible de réémettre le badge."));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <WorkspaceShell role="RESPONSABLE">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <header className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#9a7522]">
            Administration de l’établissement
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#183b32] sm:text-4xl">
            Gestion des badges
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#718078]">
            Émettez et gérez les badges des élèves. Les secrets techniques ne sont jamais affichés dans cet espace.
          </p>
        </header>

        <section aria-label="Résumé des badges" className="mb-6 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Badges actifs", value: activeCount, icon: faCircleCheck, color: "bg-[#eaf1e9] text-[#28634a]" },
            { label: "Suspendus", value: suspendedCount, icon: faPause, color: "bg-[#fff4df] text-[#956b16]" },
            { label: "Perdus ou révoqués", value: attentionCount, icon: faTriangleExclamation, color: "bg-[#f8ece8] text-[#a54c36]" },
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

        {qrBadgeId !== null && (
          <section className="mb-6 flex flex-col items-center gap-3 rounded-[1.5rem] border border-[#dfe5da] bg-white p-6 text-center">
            <h2 className="font-semibold text-[#183b32]">
              QR temporaire — {badges.find((badge) => badge.id === qrBadgeId)?.eleve_nom ?? `badge #${qrBadgeId}`}
            </h2>
            <p className="text-sm text-[#718078]">
              Le QR et son code de secours ne valident qu’un seul passage. Tous deux se renouvellent automatiquement avant expiration.
            </p>
            {qrCode && (
              <QRCodeSVG
                value={JSON.stringify({ badge_id: qrBadgeId, code: qrCode })}
                size={240}
                level="M"
                title="QR dynamique du badge"
              />
            )}
            {qrFallbackCode && (
              <div className="rounded-xl border border-[#dfe5da] bg-[#fcfcf9] px-5 py-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#718078]">
                  Code de secours si le QR ne peut pas être scanné
                </p>
                <p aria-label="Code de secours à usage unique" className="mt-2 font-mono text-2xl font-bold tracking-[0.18em] text-[#183b32]">
                  {qrFallbackCode}
                </p>
                <p className="mt-2 text-xs text-[#87938b]">
                  À saisir sur l’écran Agent · usage unique · expire avec le QR
                </p>
              </div>
            )}
            <p role="status" className="text-sm text-[#527963]">{qrStatus}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setQrCode("");
                setQrFallbackCode("");
                setQrStatus("Génération d’un nouveau QR…");
                setQrRefreshKey((key) => key + 1);
              }}
            >
              <FontAwesomeIcon icon={faRotateLeft} className="mr-2 h-3 w-3" />
              Nouveau QR pour le scan suivant
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setQrBadgeId(null);
                setQrCode("");
                setQrFallbackCode("");
              }}
            >
              Fermer le QR
            </Button>
          </section>
        )}

        <section className="mb-6 overflow-hidden rounded-[1.5rem] border border-[#e4e6dc] bg-white">
          <div className="border-b border-[#edf0e9] px-5 py-5 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eaf1e9] text-[#28634a]">
                <FontAwesomeIcon icon={faPlus} className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-semibold text-[#183b32]">Émettre un premier badge</h2>
                <p className="mt-1 text-xs text-[#87938b]">
                  Élèves actifs sans badge attribué.
                </p>
              </div>
            </div>
          </div>
          {isLoading ? (
            <p role="status" className="px-6 py-8 text-sm text-[#718078]">Chargement…</p>
          ) : studentsWithoutBadges.length === 0 ? (
            <p className="px-6 py-8 text-sm text-[#718078]">
              Tous les élèves actifs ont déjà un badge.
            </p>
          ) : (
            <ul className="divide-y divide-[#edf0e9]">
              {studentsWithoutBadges.map((student) => (
                <li
                  key={student.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#354c41]">{student.nom}</p>
                    <p className="mt-0.5 text-xs text-[#87938b]">
                      {student.classe} · {student.etablissement}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    isLoading={pendingAction === `student-${student.id}`}
                    disabled={pendingAction !== null}
                    onClick={() => void issueBadge(student)}
                    className="min-h-11 w-full !rounded-lg !bg-[#1d4b3b] hover:!bg-[#14392f] sm:w-auto"
                  >
                    <FontAwesomeIcon icon={faPlus} className="mr-2 h-3 w-3" />
                    Émettre le badge
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="overflow-hidden rounded-[1.5rem] border border-[#e4e6dc] bg-white">
          <div className="flex flex-col gap-4 border-b border-[#edf0e9] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="font-semibold text-[#183b32]">Badges émis</h2>
              <p className="mt-1 text-xs text-[#87938b]">
                {isLoading ? "Chargement…" : `${visibleBadges.length} badge(s), historique compris`}
              </p>
            </div>
            <label className="relative block w-full sm:max-w-xs">
              <span className="sr-only">Rechercher un badge ou un élève</span>
              <FontAwesomeIcon
                icon={faMagnifyingGlass}
                className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#87938b]"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nom de l’élève ou état"
                className="w-full rounded-xl border border-[#dfe5da] bg-[#fcfcf9] py-2.5 pl-10 pr-3 text-sm text-[#354c41] outline-none transition placeholder:text-[#a3ada5] focus:border-[#527963] focus:bg-white focus:ring-4 focus:ring-[#527963]/10"
              />
            </label>
          </div>

          {isLoading ? (
            <div role="status" className="px-6 py-14 text-center text-sm text-[#718078]">
              Chargement des badges…
            </div>
          ) : visibleBadges.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <FontAwesomeIcon icon={faIdCard} className="h-6 w-6 text-[#98a39b]" />
              <p className="mt-3 text-sm font-semibold text-[#52655e]">
                {badges.length === 0 ? "Aucun badge émis" : "Aucun résultat"}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-[#edf0e9]">
              {visibleBadges.map((badge) => {
                const isCurrent = !replacedBadgeIds.has(badge.id);
                const studentIsActive = students.find((student) => student.id === badge.eleve_id)?.etat === "ACTIF";
                const busy = pendingAction === `badge-${badge.id}`;
                const emittedDate = new Date(badge.date_emission).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });
                return (
                  <li
                    key={badge.id}
                    className="flex flex-col gap-4 px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f2f4ee] text-[#527963]">
                        <FontAwesomeIcon icon={faIdCard} className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-[#354c41]">{badge.eleve_nom}</p>
                          <Badge variant={badge.etat === "ACTIF" ? "success" : badge.etat === "SUSPENDU" ? "warning" : "secondary"}>
                            {STATE_LABELS[badge.etat]}
                          </Badge>
                          {!isCurrent && <Badge variant="secondary">Remplacé</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-[#87938b]">
                          Émis le {emittedDate} · Référence #{badge.id}
                        </p>
                      </div>
                    </div>

                    {isCurrent && studentIsActive && (
                      <div className="flex flex-wrap gap-2">
                      {badge.etat === "ACTIF" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={pendingAction !== null}
                          onClick={() => {
                            setQrCode("");
                            setQrFallbackCode("");
                            setQrStatus("Génération du QR temporaire…");
                            setQrBadgeId(badge.id);
                          }}
                          className="min-h-11 !rounded-lg !border-[#dfe5da] !text-[#52655e] sm:min-h-0"
                        >
                          <FontAwesomeIcon icon={faQrcode} className="mr-2 h-3 w-3" />
                          Présenter le QR
                        </Button>
                      )}
                        {(badge.etat === "ACTIF" || badge.etat === "SUSPENDU") && (
                          <>
                            {badge.etat === "ACTIF" ? (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={pendingAction !== null}
                                onClick={() => void changeBadgeState(badge, "SUSPENDU")}
                                className="min-h-11 !rounded-lg !border-[#dfe5da] !text-[#52655e] sm:min-h-0"
                              >
                                <FontAwesomeIcon icon={faPause} className="mr-2 h-3 w-3" />
                                Suspendre
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={pendingAction !== null}
                                onClick={() => void changeBadgeState(badge, "ACTIF")}
                                className="min-h-11 !rounded-lg !border-[#dfe5da] !text-[#52655e] sm:min-h-0"
                              >
                                <FontAwesomeIcon icon={faRotateLeft} className="mr-2 h-3 w-3" />
                                Réactiver
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={pendingAction !== null}
                              onClick={() => void changeBadgeState(badge, "PERDU")}
                              className="min-h-11 !rounded-lg !border-[#f0dfc0] !text-[#956b16] sm:min-h-0"
                            >
                              <FontAwesomeIcon icon={faTriangleExclamation} className="mr-2 h-3 w-3" />
                              Marquer perdu
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={pendingAction !== null}
                              onClick={() => void changeBadgeState(badge, "REVOQUE")}
                              className="min-h-11 !rounded-lg !border-[#ecd5d0] !text-[#a54c36] sm:min-h-0"
                            >
                              <FontAwesomeIcon icon={faBan} className="mr-2 h-3 w-3" />
                              Révoquer
                            </Button>
                          </>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          isLoading={busy}
                          disabled={pendingAction !== null}
                          onClick={() => void reissueBadge(badge)}
                          className="min-h-11 !rounded-lg !border-[#dfe5da] !text-[#52655e] sm:min-h-0"
                        >
                          <FontAwesomeIcon icon={faRotateLeft} className="mr-2 h-3 w-3" />
                          Réémettre
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </WorkspaceShell>
  );
}

export default function ResponsableBadgesPage() {
  return (
    <RoleGate role="RESPONSABLE">
      <BadgeManagement />
    </RoleGate>
  );
}
