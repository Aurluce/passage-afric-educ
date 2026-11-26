"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) {
      return;
    }

    let active = true;
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error: unknown) => {
      if (active) {
        console.error("Impossible d’enregistrer le service worker Passage.", error);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  return null;
}
