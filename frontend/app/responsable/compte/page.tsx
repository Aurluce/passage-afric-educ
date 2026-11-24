"use client";

import * as React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faIdCard,
  faLock,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { Button } from "@/components/button";
import { Input } from "@/components/input";
import { RoleGate } from "@/components/role-gate";
import { WorkspaceShell } from "@/components/workspace-shell";
import { useAuth } from "@/contexts/auth-context";
import { api, type PasswordChangeInput, type ResponsableProfileInput } from "@/lib/api";

const EMPTY_PROFILE: ResponsableProfileInput = {
  identifiant: "",
  nom: "",
};

const EMPTY_PASSWORD: PasswordChangeInput = {
  mot_de_passe_actuel: "",
  nouveau_mot_de_passe: "",
  confirmation_mot_de_passe: "",
};

function messageFromError(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function ResponsableAccount() {
  const { updateUser } = useAuth();
  const [profile, setProfile] = React.useState(EMPTY_PROFILE);
  const [password, setPassword] = React.useState(EMPTY_PASSWORD);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isSavingProfile, setIsSavingProfile] = React.useState(false);
  const [isSavingPassword, setIsSavingPassword] = React.useState(false);
  const [error, setError] = React.useState("");
  const [success, setSuccess] = React.useState("");

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      void api.getResponsableProfile()
        .then((user) => {
          setProfile({ identifiant: user.identifiant, nom: user.nom });
          updateUser(user);
        })
        .catch((loadError: unknown) => {
          setError(messageFromError(loadError, "Impossible de charger votre compte."));
        })
        .finally(() => setIsLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [updateUser]);

  const handleProfileSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingProfile(true);
    setError("");
    setSuccess("");
    try {
      const updated = await api.updateResponsableProfile(profile);
      setProfile({ identifiant: updated.identifiant, nom: updated.nom });
      updateUser(updated);
      setSuccess("Les informations de votre compte ont été mises à jour.");
    } catch (saveError) {
      setError(messageFromError(saveError, "Impossible de modifier votre compte."));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSavingPassword(true);
    setError("");
    setSuccess("");
    try {
      await api.changeResponsablePassword(password);
      setPassword(EMPTY_PASSWORD);
      setSuccess("Votre mot de passe a été modifié.");
    } catch (saveError) {
      setError(messageFromError(saveError, "Impossible de modifier le mot de passe."));
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <WorkspaceShell role="RESPONSABLE">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
        <header className="mb-8">
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#9a7522]">
            Espace personnel
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#183b32] sm:text-4xl">
            Mon compte
          </h1>
          <p className="mt-2 text-sm text-[#718078]">
            Mettez à jour vos informations et sécurisez votre accès.
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

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <section className="rounded-[1.5rem] border border-[#e4e6dc] bg-white p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eaf1e9] text-[#28634a]">
                <FontAwesomeIcon icon={faUser} className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-semibold text-[#183b32]">Informations du compte</h2>
                <p className="mt-1 text-xs text-[#87938b]">Ces informations sont privées à votre profil.</p>
              </div>
            </div>

            {isLoading ? (
              <p role="status" className="mt-6 text-sm text-[#718078]">Chargement du compte…</p>
            ) : (
              <form onSubmit={handleProfileSubmit} className="mt-6 space-y-4">
                <Input
                  id="account-name"
                  label="Nom affiché"
                  autoComplete="name"
                  maxLength={120}
                  required
                  value={profile.nom}
                  onChange={(event) => setProfile({ ...profile, nom: event.target.value })}
                  className="!rounded-xl !border-[#dfe5da] !bg-[#fcfcf9] !text-[#354c41]"
                />
                <Input
                  id="account-identifier"
                  label="Identifiant de connexion"
                  icon={<FontAwesomeIcon icon={faIdCard} className="h-4 w-4" />}
                  autoComplete="username"
                  maxLength={64}
                  required
                  value={profile.identifiant}
                  onChange={(event) => setProfile({ ...profile, identifiant: event.target.value })}
                  className="!rounded-xl !border-[#dfe5da] !bg-[#fcfcf9] !text-[#354c41]"
                />
                <div>
                  <p className="mb-1.5 block text-xs font-semibold text-[#52655e]">Rôle</p>
                  <p className="rounded-xl border border-[#edf0e9] bg-[#f7f7f1] px-3.5 py-3 text-sm text-[#718078]">
                    Responsable · le rôle ne peut pas être modifié ici
                  </p>
                </div>
                <Button
                  type="submit"
                  isLoading={isSavingProfile}
                  disabled={isLoading || isSavingPassword}
                  className="w-full !rounded-xl !bg-[#1d4b3b] py-3 text-sm hover:!bg-[#14392f]"
                >
                  Enregistrer les informations
                </Button>
              </form>
            )}
          </section>

          <section className="rounded-[1.5rem] border border-[#e4e6dc] bg-white p-5 sm:p-7">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#fff4df] text-[#956b16]">
                <FontAwesomeIcon icon={faLock} className="h-4 w-4" />
              </span>
              <div>
                <h2 className="font-semibold text-[#183b32]">Changer le mot de passe</h2>
                <p className="mt-1 text-xs text-[#87938b]">Confirmez votre mot de passe actuel pour continuer.</p>
              </div>
            </div>

            <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
              <Input
                id="current-password"
                label="Mot de passe actuel"
                type="password"
                autoComplete="current-password"
                required
                value={password.mot_de_passe_actuel}
                onChange={(event) => setPassword({ ...password, mot_de_passe_actuel: event.target.value })}
                className="!rounded-xl !border-[#dfe5da] !bg-[#fcfcf9] !text-[#354c41]"
              />
              <Input
                id="new-password"
                label="Nouveau mot de passe"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password.nouveau_mot_de_passe}
                onChange={(event) => setPassword({ ...password, nouveau_mot_de_passe: event.target.value })}
                className="!rounded-xl !border-[#dfe5da] !bg-[#fcfcf9] !text-[#354c41]"
              />
              <Input
                id="confirm-password"
                label="Confirmer le nouveau mot de passe"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={password.confirmation_mot_de_passe}
                onChange={(event) => setPassword({ ...password, confirmation_mot_de_passe: event.target.value })}
                className="!rounded-xl !border-[#dfe5da] !bg-[#fcfcf9] !text-[#354c41]"
              />
              <div className="rounded-xl border border-[#edf0e9] bg-[#f7f7f1] px-4 py-3 text-xs leading-5 text-[#718078]">
                <p className="font-semibold text-[#52655e]">Exigences du cahier</p>
                <ul className="mt-1 list-inside list-disc">
                  <li>Au moins 8 caractères</li>
                  <li>Ne pas être un mot de passe courant ou uniquement numérique</li>
                  <li>Ne pas être trop proche de votre nom ou identifiant</li>
                </ul>
              </div>
              <Button
                type="submit"
                isLoading={isSavingPassword}
                disabled={isLoading || isSavingProfile}
                className="w-full !rounded-xl !bg-[#1d4b3b] py-3 text-sm hover:!bg-[#14392f]"
              >
                Modifier le mot de passe
              </Button>
            </form>
          </section>
        </div>
      </div>
    </WorkspaceShell>
  );
}

export default function ResponsableAccountPage() {
  return (
    <RoleGate role="RESPONSABLE">
      <ResponsableAccount />
    </RoleGate>
  );
}
