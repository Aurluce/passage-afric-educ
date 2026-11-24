import type { User, UserRole } from "@/contexts/auth-context";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "";

export interface Student {
  id: number;
  nom: string;
  classe: string;
  etablissement: string;
  etat: "ACTIF" | "INACTIF";
}

export interface StudentInput {
  nom: string;
  classe: string;
  etablissement: string;
}

export type BadgeState = "ACTIF" | "SUSPENDU" | "PERDU" | "REVOQUE";

export interface StudentBadge {
  id: number;
  eleve_id: number;
  eleve_nom: string;
  etat: BadgeState;
  date_emission: string;
  badge_remplace: number | null;
}

export interface ResponsableProfileInput {
  identifiant: string;
  nom: string;
}

export interface PasswordChangeInput {
  mot_de_passe_actuel: string;
  nouveau_mot_de_passe: string;
  confirmation_mot_de_passe: string;
}

async function responseError(res: Response, fallback: string): Promise<Error> {
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object") {
      const values = Object.values(body as Record<string, unknown>);
      const message = values
        .flatMap((value) => Array.isArray(value) ? value : [value])
        .find((value): value is string => typeof value === "string");
      if (message) return new Error(message);
    }
  } catch {
    return new Error(fallback);
  }
  return new Error(fallback);
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

function setTokens(access: string, refresh: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
}

function clearTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

async function request(
  input: RequestInfo | URL,
  init?: RequestInit,
  authenticated = true
): Promise<Response> {
  const token = getToken();
  const headers: HeadersInit = {
    ...(init?.headers || {}),
  };
  if (token && authenticated) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }
  if (!(init?.body instanceof FormData)) {
    (headers as Record<string, string>)["Content-Type"] = "application/json";
  }

  return fetch(`${API_BASE}${input}`, {
    ...init,
    headers,
  });
}

export const api = {
  async login(identifiant: string, password: string, expectedRole: UserRole): Promise<User> {
    const res = await request(
      "/api/auth/login",
      {
        method: "POST",
        body: JSON.stringify({ identifiant, password }),
      },
      false
    );
    if (!res.ok) {
      throw await responseError(res, "Identifiants invalides.");
    }
    const data = (await res.json()) as { access: string; refresh: string; user: User };
    if (data.user.role !== expectedRole) {
      const labels: Record<UserRole, string> = {
        RESPONSABLE: "Responsable",
        AGENT: "Agent de portail",
        PARENT: "Parent",
      };
      throw new Error(`Ce compte est associé au rôle « ${labels[data.user.role]} ». Sélectionnez le bon rôle pour continuer.`);
    }
    setTokens(data.access, data.refresh);
    return data.user;
  },

  async listStudents(): Promise<Student[]> {
    const res = await request("/api/responsable/eleves");
    if (!res.ok) {
      throw await responseError(res, "Impossible de charger la liste des élèves.");
    }
    return (await res.json()) as Student[];
  },

  async createStudent(student: StudentInput): Promise<Student> {
    const res = await request("/api/responsable/eleves", {
      method: "POST",
      body: JSON.stringify(student),
    });
    if (!res.ok) {
      throw await responseError(res, "Impossible d’ajouter cet élève.");
    }
    return (await res.json()) as Student;
  },

  async updateStudent(
    id: number,
    changes: Partial<StudentInput> & { etat?: Student["etat"] }
  ): Promise<Student> {
    const res = await request(`/api/responsable/eleves/${id}`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    });
    if (!res.ok) {
      throw await responseError(res, "Impossible de modifier cet élève.");
    }
    return (await res.json()) as Student;
  },

  async getResponsableProfile(): Promise<User> {
    const res = await request("/api/responsable/compte");
    if (!res.ok) {
      throw await responseError(res, "Impossible de charger votre compte.");
    }
    return (await res.json()) as User;
  },

  async updateResponsableProfile(changes: ResponsableProfileInput): Promise<User> {
    const res = await request("/api/responsable/compte", {
      method: "PATCH",
      body: JSON.stringify(changes),
    });
    if (!res.ok) {
      throw await responseError(res, "Impossible de modifier votre compte.");
    }
    return (await res.json()) as User;
  },

  async changeResponsablePassword(changes: PasswordChangeInput): Promise<void> {
    const res = await request("/api/responsable/compte/mot-de-passe", {
      method: "POST",
      body: JSON.stringify(changes),
    });
    if (!res.ok) {
      throw await responseError(res, "Impossible de modifier le mot de passe.");
    }
  },

  async listBadges(): Promise<StudentBadge[]> {
    const res = await request("/api/responsable/badges");
    if (!res.ok) {
      throw await responseError(res, "Impossible de charger les badges.");
    }
    return (await res.json()) as StudentBadge[];
  },

  async issueBadge(studentId: number): Promise<StudentBadge> {
    const res = await request(`/api/responsable/eleves/${studentId}/badge`, {
      method: "POST",
    });
    if (!res.ok) {
      throw await responseError(res, "Impossible d’émettre le badge.");
    }
    return (await res.json()) as StudentBadge;
  },

  async reissueBadge(badgeId: number): Promise<StudentBadge> {
    const res = await request(`/api/responsable/badges/${badgeId}/reemettre`, {
      method: "POST",
    });
    if (!res.ok) {
      throw await responseError(res, "Impossible de réémettre le badge.");
    }
    return (await res.json()) as StudentBadge;
  },

  async updateBadgeState(badgeId: number, etat: BadgeState): Promise<StudentBadge> {
    const res = await request(`/api/responsable/badges/${badgeId}`, {
      method: "PATCH",
      body: JSON.stringify({ etat }),
    });
    if (!res.ok) {
      throw await responseError(res, "Impossible de modifier l’état du badge.");
    }
    return (await res.json()) as StudentBadge;
  },

  async logout() {
    const refresh = localStorage.getItem("refresh_token");
    try {
      if (refresh) {
        const res = await request("/api/auth/logout", {
          method: "POST",
          body: JSON.stringify({ refresh }),
        });
        if (!res.ok) {
          throw await responseError(res, "La session n’a pas pu être fermée sur le serveur.");
        }
      }
    } finally {
      clearTokens();
    }
  },

  isAuthenticated(): boolean {
    return !!getToken();
  },
};