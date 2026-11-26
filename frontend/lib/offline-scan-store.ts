export interface PassageScan {
  event_id_local: string;
  badge_id: number | null;
  badge_code: string | null;
  code_secours?: string | null;
  point_id: number;
  heure_locale: string;
}

const DATABASE_NAME = "passage-offline";
const DATABASE_VERSION = 1;
const STORE_NAME = "scans";

let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB n'est pas disponible dans ce navigateur."));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME, { keyPath: "event_id_local" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Impossible d'ouvrir IndexedDB."));
    request.onblocked = () => reject(new Error("La mise à jour de la base IndexedDB est bloquée."));
  });
  databasePromise.catch(() => {
    databasePromise = undefined;
  });
  return databasePromise;
}

export async function chargerScans(): Promise<PassageScan[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const request = transaction.objectStore(STORE_NAME).getAll();
    let scans: PassageScan[] = [];

    request.onsuccess = () => {
      scans = request.result as PassageScan[];
    };
    request.onerror = () => reject(request.error ?? new Error("Impossible de lire les scans locaux."));
    transaction.oncomplete = () => resolve(scans);
    transaction.onerror = () => reject(transaction.error ?? new Error("Lecture IndexedDB échouée."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Lecture IndexedDB annulée."));
  });
}

export async function remplacerScans(scans: PassageScan[]): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    store.clear();
    scans.forEach((scan) => store.put(scan));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Écriture IndexedDB échouée."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Écriture IndexedDB annulée."));
  });
}

export function isPassageScan(value: unknown): value is PassageScan {
  if (!value || typeof value !== "object") return false;
  const scan = value as Record<string, unknown>;
  const hasSignedCode =
    typeof scan.badge_id === "number" &&
    Number.isInteger(scan.badge_id) &&
    typeof scan.badge_code === "string";
  const hasManualCode =
    typeof scan.code_secours === "string" && scan.code_secours.trim().length > 0;
  return (
    typeof scan.event_id_local === "string" &&
    hasSignedCode !== hasManualCode &&
    typeof scan.point_id === "number" &&
    Number.isInteger(scan.point_id) &&
    typeof scan.heure_locale === "string"
  );
}
