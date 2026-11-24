"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faArrowRight,
  faCheck,
  faIdCard,
  faLock,
  faShieldHalved,
  faUserShield,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { api } from "@/lib/api";
import { useAuth, type UserRole } from "@/contexts/auth-context";
import { Button } from "@/components/button";
import { Input } from "@/components/input";

const ROLE_CONFIG: Record<UserRole, { label: string; icon: typeof faUserShield; href: string }> = {
  RESPONSABLE: { label: "Responsable", icon: faUserShield, href: "/responsable" },
  AGENT: { label: "Agent", icon: faIdCard, href: "/scan" },
  PARENT: { label: "Parent", icon: faUsers, href: "/parent" },
};

export default function LoginPage() {
  const router = useRouter();
  const { login, user, isReady } = useAuth();
  const [identifiant, setIdentifiant] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [role, setRole] = React.useState<UserRole>("RESPONSABLE");
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (isReady && user && api.isAuthenticated()) {
      router.replace(ROLE_CONFIG[user.role].href);
    }
  }, [isReady, router, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const user = await api.login(identifiant, password, role);
      login(user);
      router.replace(ROLE_CONFIG[user.role].href);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-svh bg-[#f7f7f1] lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(460px,0.95fr)]">
      <section className="relative hidden min-h-svh overflow-hidden bg-[#123b35] px-10 py-9 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div className="absolute -right-36 -top-32 h-[28rem] w-[28rem] rounded-full border border-white/10" />
        <div className="absolute -right-16 -top-12 h-[20rem] w-[20rem] rounded-full border border-white/10" />
        <div className="absolute -bottom-40 -left-28 h-[30rem] w-[30rem] rounded-full bg-[#1f594a]/70 blur-2xl" />

        <Link href="/" className="relative z-10 inline-flex w-fit items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#e6b84a] text-[#123b35]">
            <FontAwesomeIcon icon={faIdCard} className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-lg font-bold tracking-tight">Passage</span>
            <span className="block text-xs text-white/60">Afric&apos;Éduc</span>
          </span>
        </Link>

        <div className="relative z-10 max-w-xl py-14">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80">
            <span className="h-2 w-2 rounded-full bg-[#e6b84a]" />
            Le suivi scolaire, simplement
          </span>
          <h1 className="text-5xl font-semibold leading-[1.12] tracking-tight xl:text-6xl">
            Chaque passage
            <br />
            <span className="font-serif italic font-normal text-[#f0ca70]">compte.</span>
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-white/70">
            Un espace de confiance pour suivre les entrées et sorties des élèves,
            en temps réel ou même sans connexion.
          </p>

          <div className="mt-10 space-y-4">
            {[
              "Un accès adapté à chaque rôle",
              "Un suivi clair pour les familles",
              "Des données synchronisées en toute sécurité",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-sm text-white/85">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[#f0ca70]">
                  <FontAwesomeIcon icon={faCheck} className="h-3 w-3" />
                </span>
                {item}
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-white/45">
          Une présence rassurante, du portail à la maison.
        </p>
      </section>

      <section className="flex min-h-svh flex-col px-5 py-6 sm:px-8 lg:px-12 xl:px-20">
        <div className="flex items-center justify-between lg:justify-end">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-[#52655e] transition hover:text-[#123b35] lg:hidden">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#123b35] shadow-sm">
              <FontAwesomeIcon icon={faIdCard} className="h-4 w-4" />
            </span>
            <span className="font-semibold">Passage</span>
          </Link>
          <Link href="/" className="hidden items-center gap-2 text-sm text-[#75827b] transition hover:text-[#123b35] lg:inline-flex">
            <FontAwesomeIcon icon={faArrowLeft} className="h-3 w-3" />
            Retour à l’accueil
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-[440px] flex-1 flex-col justify-center py-10">
          <div className="mb-8">
            <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#9a7522]">Bienvenue</p>
            <h2 className="text-3xl font-semibold tracking-tight text-[#183b32] sm:text-4xl">Connectez-vous</h2>
            <p className="mt-2 text-sm leading-6 text-[#718078]">
              Retrouvez votre espace Passage en quelques secondes.
            </p>
          </div>

          <div className="mb-6">
            <p className="mb-3 text-sm font-medium text-[#43564d]">Je suis</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ROLE_CONFIG) as UserRole[]).map((currentRole) => {
                const active = role === currentRole;
                return (
                  <button
                    key={currentRole}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setRole(currentRole)}
                    className={`flex min-h-[76px] flex-col items-center justify-center gap-2 rounded-2xl border px-2 text-xs font-semibold transition ${
                      active
                        ? "border-[#245a49] bg-[#eaf1e9] text-[#1d4b3b] shadow-sm"
                        : "border-[#e4e6dc] bg-white/70 text-[#718078] hover:border-[#bac9bd] hover:bg-white"
                    }`}
                  >
                    <FontAwesomeIcon icon={ROLE_CONFIG[currentRole].icon} className="h-4 w-4" />
                    {ROLE_CONFIG[currentRole].label}
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="identifiant"
              label="Identifiant"
              icon={<FontAwesomeIcon icon={faIdCard} className="h-4 w-4" />}
              placeholder="Ex. : responsable"
              autoComplete="username"
              value={identifiant}
              onChange={(e) => setIdentifiant(e.target.value)}
              required
            />
            <Input
              id="password"
              label="Mot de passe"
              type="password"
              icon={<FontAwesomeIcon icon={faLock} className="h-4 w-4" />}
              placeholder="Votre mot de passe"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            {error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" isLoading={isLoading} className="mt-2 w-full !rounded-xl !bg-[#1d4b3b] py-3.5 text-sm hover:!bg-[#14392f]">
              Se connecter
              {!isLoading && <FontAwesomeIcon icon={faArrowRight} className="ml-2 h-3.5 w-3.5" />}
            </Button>
          </form>

          <div className="mt-6 flex items-start gap-3 rounded-xl border border-[#e4e6dc] bg-white/60 px-4 py-3.5">
            <FontAwesomeIcon icon={faShieldHalved} className="mt-0.5 h-4 w-4 text-[#527963]" />
            <p className="text-xs leading-5 text-[#718078]">
              Vos informations sont protégées et accessibles uniquement depuis votre espace.
            </p>
          </div>

          <details className="mt-5 rounded-xl border border-[#e4e6dc] bg-white/60 px-4 py-3">
            <summary className="cursor-pointer text-xs font-semibold text-[#52655e]">
              Comptes de démonstration
            </summary>
            <div className="mt-3 space-y-2 border-t border-[#e9ebe3] pt-3 text-xs text-[#718078]">
              <p><span className="font-semibold text-[#43564d]">Responsable</span> · responsable / Responsable!2026</p>
              <p><span className="font-semibold text-[#43564d]">Agent</span> · agent01 / Agent!2026</p>
              <p><span className="font-semibold text-[#43564d]">Parent</span> · parent1 / Parent1!2026</p>
            </div>
          </details>
        </div>

        <p className="pb-2 text-center text-xs text-[#94a098]">
          Afric&apos;Éduc · Passage — Suivi scolaire en toute sérénité
        </p>
      </section>
    </main>
  );
}
