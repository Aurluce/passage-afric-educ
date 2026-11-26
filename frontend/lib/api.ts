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

export interface ControlPoint {
  id: number;
  etablissement: string;
  libelle: string;
  type: "PORTAIL" | "AUTOBUS";
}

export type ControlPointInput = Omit<ControlPoint, "id">;

export interface AgentAccount {
  id: number;
  identifiant: string;
  nom: string;
  point_controle_ids: number[];
}

export interface StudentRoute {
  id: number;
  eleve_id: number;
  eleve_nom: string;
  point_id: number;
  point_libelle: string;
  ordre: number;
  heure_debut: string;
  heure_fin: string;
  jours_application: string;
}

export type StudentRouteInput = Omit<StudentRoute, "id" | "eleve_nom" | "point_libelle">;

export interface ResponsiblePassage {
  id: number;
  eleve_id: number;
  eleve_nom: string;
  point_id: number;
  point_libelle: string;
  heure_locale: string;
  heure_serveur: string;
  appareil_id: string;
  sync_etat: "RECU" | "REJETE_HORLOGE";
}

export type AnomalyType =
  | "ABSENCE"
  | "HORS_FENETRE"
  | "POINT_INATTENDU"
  | "DOUBLE_SCAN"
  | "HORLOGE_SUSPECTE";

export interface ResponsibleAnomaly {
  id: number;
  eleve_id: number;
  eleve_nom: string;
  type: AnomalyType;
  date: string;
  traite: boolean;
  cree_le: string;
  passage_id: number | null;
  passage_point: string | null;
}

export interface DailySummary {
  classe: string;
  date: string;
  chiffres: Record<string, string | number>;
  texte: string;
  origine: "MODELE" | "GABARIT";
}

export interface BadgeQrCode {
  badge_id: number;
  code: string;
  code_secours: string;
  expire_dans: number;
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

  async listControlPoints(): Promise<ControlPoint[]> {
    const res = await request("/api/responsable/points");
    if (!res.ok) {
      throw await responseError(res, "Impossible de charger les points de contrôle.");
    }
    return (await res.json()) as ControlPoint[];
  },

  async listAgents(): Promise<AgentAccount[]> {
    const res = await request("/api/responsable/agents");
    if (!res.ok) {
      throw await responseError(res, "Impossible de charger les comptes Agent.");
    }
    return (await res.json()) as AgentAccount[];
  },

  async assignAgentControlPoints(agentId: number, pointIds: number[]): Promise<AgentAccount> {
    const res = await request(`/api/responsable/agents/${agentId}`, {
      method: "PATCH",
      body: JSON.stringify({ point_controle_ids: pointIds }),
    });
    if (!res.ok) {
      throw await responseError(res, "Impossible d’affecter ces points à l’agent.");
    }
    return (await res.json()) as AgentAccount;
  },

  async createControlPoint(point: ControlPointInput): Promise<ControlPoint> {
    const res = await request("/api/responsable/points", {
      method: "POST",
      body: JSON.stringify(point),
    });
    if (!res.ok) {
      throw await responseError(res, "Impossible de créer le point de contrôle.");
    }
    return (await res.json()) as ControlPoint;
  },

  async updateControlPoint(id: number, changes: Partial<ControlPointInput>): Promise<ControlPoint> {
    const res = await request(`/api/responsable/points/${id}`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    });
    if (!res.ok) {
      throw await responseError(res, "Impossible de modifier le point de contrôle.");
    }
    return (await res.json()) as ControlPoint;
  },

  async listStudentRoutes(studentId: number): Promise<StudentRoute[]> {
    const res = await request(`/api/responsable/itineraires?eleve_id=${studentId}`);
    if (!res.ok) {
      throw await responseError(res, "Impossible de charger l’itinéraire.");
    }
    return (await res.json()) as StudentRoute[];
  },

  async createStudentRoute(route: StudentRouteInput): Promise<StudentRoute> {
    const res = await request("/api/responsable/itineraires", {
      method: "POST",
      body: JSON.stringify(route),
    });
    if (!res.ok) {
      throw await responseError(res, "Impossible d’ajouter ce point à l’itinéraire.");
    }
    return (await res.json()) as StudentRoute;
  },

  async updateStudentRoute(id: number, changes: Partial<StudentRouteInput>): Promise<StudentRoute> {
    const res = await request(`/api/responsable/itineraires/${id}`, {
      method: "PATCH",
      body: JSON.stringify(changes),
    });
    if (!res.ok) {
      throw await responseError(res, "Impossible de modifier l’itinéraire.");
    }
    return (await res.json()) as StudentRoute;
  },

  async listResponsiblePassages(filters: {
    eleve_id?: number;
    point_id?: number;
    date?: string;
  }): Promise<ResponsiblePassage[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.set(key, String(value));
    });
    const res = await request(`/api/responsable/passages${params.size ? `?${params}` : ""}`);
    if (!res.ok) {
      throw await responseError(res, "Impossible de charger les passages.");
    }
    return (await res.json()) as ResponsiblePassage[];
  },

  async listResponsibleAnomalies(filters: {
    eleve_id?: number;
    type?: AnomalyType | "";
    date?: string;
    traite?: boolean;
  }): Promise<ResponsibleAnomaly[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.set(key, String(value));
    });
    const res = await request(`/api/responsable/anomalies${params.size ? `?${params}` : ""}`);
    if (!res.ok) {
      throw await responseError(res, "Impossible de charger les anomalies.");
    }
    return (await res.json()) as ResponsibleAnomaly[];
  },

  async markAnomalyTreated(id: number, traite: boolean): Promise<ResponsibleAnomaly> {
    const res = await request(`/api/responsable/anomalies/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ traite }),
    });
    if (!res.ok) {
      throw await responseError(res, "Impossible de modifier l’anomalie.");
    }
    return (await res.json()) as ResponsibleAnomaly;
  },

  async generateDailySummary(classe: string, date: string): Promise<DailySummary> {
    const res = await request("/api/responsable/synthese", {
      method: "POST",
      body: JSON.stringify({ classe, date }),
    });
    if (!res.ok) {
      throw await responseError(res, "Impossible de générer la synthèse.");
    }
    return (await res.json()) as DailySummary;
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

  async generateBadgeQrCode(badgeId: number): Promise<BadgeQrCode> {
    const res = await request(`/api/responsable/badges/${badgeId}/code`, {
      method: "POST",
    });
    if (!res.ok) {
      throw await responseError(res, "Impossible de générer le QR temporaire.");
    }
    return (await res.json()) as BadgeQrCode;
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