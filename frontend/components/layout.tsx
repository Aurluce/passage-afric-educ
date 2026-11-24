"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faHome,
  faIdCard,
  faUsers,
  faUserShield,
  faSignOutAlt,
  faChartPie,
} from "@fortawesome/free-solid-svg-icons";
import { Button } from "./button";

interface LayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: "/", label: "Accueil", icon: faHome },
  { href: "/scan", label: "Scan Badge", icon: faIdCard },
  { href: "/parent", label: "Espace Parent", icon: faUsers },
];

export function Layout({ children }: LayoutProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-africa-bg-primary">
      {/* Navigation Top */}
      <nav className="bg-africa-bg-surface border-b border-africa-border sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-africa-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <FontAwesomeIcon icon={faIdCard} className="w-5 h-5" />
              </div>
              <span className="font-bold text-xl text-africa-text-primary tracking-tight">
                Passage
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-6">
              {navItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-africa-indigo-50 text-africa-indigo-700"
                        : "text-africa-text-secondary hover:bg-africa-bg-primary hover:text-africa-text-primary"
                    }`}
                  >
                    <FontAwesomeIcon
                      icon={item.icon}
                      className={`w-4 h-4 ${isActive ? "text-africa-indigo-600" : "text-africa-text-secondary"}`}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" className="hidden md:block">
                <FontAwesomeIcon icon={faChartPie} className="w-4 h-4 mr-1" />
                Synthèse
              </Button>
              <Button variant="outline" size="sm">
                <FontAwesomeIcon icon={faSignOutAlt} className="w-4 h-4 mr-1" />
                Déconnexion
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <nav className="md:hidden border-b border-africa-border bg-africa-bg-surface">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <Link href="/" className="font-bold text-xl text-africa-text-primary">
              Passage
            </Link>
          </div>
          <div className="mt-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-4 py-3 rounded-lg text-base ${
                  pathname === item.href
                    ? "bg-africa-indigo-50 text-africa-indigo-700"
                    : "text-africa-text-secondary hover:bg-africa-bg-primary hover:text-africa-text-primary"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-slide-in">{children}</div>
      </main>

      {/* Footer */}
      <footer className="border-t border-africa-border bg-africa-bg-surface mt-auto py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-africa-slate">
            Afric&apos;Éduc · Passage — Suivi des passages d'élèves par badge
          </p>
        </div>
      </footer>
    </div>
  );
}