import type { Metadata, Viewport } from "next";
import { AuthProvider } from "@/contexts/auth-context";
import { ServiceWorkerRegister } from "@/components/sw-register";
import "./globals.css";

import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
config.autoAddCss = false;

export const metadata: Metadata = {
  title: "Passage — Afric'Éduc",
  description: "Suivi des passages d'élèves par badge, en conditions de réseau dégradé.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Passage",
  },
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#183b32",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <AuthProvider>
        <body className="min-h-svh">
          <ServiceWorkerRegister />
          {children}
        </body>
      </AuthProvider>
    </html>
  );
}