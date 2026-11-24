import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowRight,
  faArrowUpRightFromSquare,
  faChartPie,
  faClock,
  faIdCard,
  faSchool,
  faShieldHalved,
  faUserShield,
  faUsers,
  faWifi,
} from "@fortawesome/free-solid-svg-icons";

const parcours = [
  {
    href: "/login",
    icon: faUserShield,
    title: "Responsable",
    description: "Pilotez les accès, les élèves et le suivi de votre établissement.",
    label: "Gestion de l’établissement",
    tone: "bg-[#f8f0da] text-[#927021]",
  },
  {
    href: "/scan",
    icon: faIdCard,
    title: "Agent de portail",
    description: "Enregistrez les passages en quelques secondes, même hors ligne.",
    label: "Pointage des élèves",
    tone: "bg-[#e7f0e9] text-[#28634a]",
  },
  {
    href: "/parent",
    icon: faUsers,
    title: "Parent",
    description: "Suivez les passages de vos enfants et restez informé.",
    label: "Suivi de la famille",
    tone: "bg-[#e8eef5] text-[#45627c]",
  },
];

const stats = [
  { value: "En temps réel", label: "Suivi des passages", icon: faClock },
  { value: "Même hors ligne", label: "Synchronisation simple", icon: faWifi },
  { value: "Un espace par rôle", label: "Informations pertinentes", icon: faChartPie },
];

export default function Accueil() {
  return (
    <main className="min-h-svh bg-[#f7f7f1] text-[#183b32]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#1d4b3b] text-[#f0ca70] shadow-sm">
            <FontAwesomeIcon icon={faIdCard} className="h-5 w-5" />
          </span>
          <span>
            <span className="block text-base font-bold tracking-tight">Passage</span>
            <span className="block text-[11px] text-[#829087]">Afric&apos;Éduc</span>
          </span>
        </Link>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-full bg-[#1d4b3b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#14392f] sm:px-5"
        >
          Se connecter
          <FontAwesomeIcon icon={faArrowRight} className="h-3 w-3" />
        </Link>
      </header>

      <section className="relative overflow-hidden px-5 pb-16 pt-9 sm:px-8 sm:pb-20 sm:pt-14 lg:px-12 lg:pb-24 lg:pt-20">
        <div className="absolute -right-36 top-0 h-[34rem] w-[34rem] rounded-full bg-[#e6ebdd] blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="max-w-2xl">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#dfe5da] bg-white/70 px-3.5 py-2 text-xs font-semibold text-[#527963]">
              <span className="h-2 w-2 rounded-full bg-[#d6a839]" />
              La présence scolaire, en toute confiance
            </p>
            <h1 className="text-[2.9rem] font-semibold leading-[1.08] tracking-[-0.045em] text-[#183b32] sm:text-6xl lg:text-[4.25rem]">
              L’école et les familles,
              <span className="mt-1 block font-serif italic font-normal text-[#a17a26]">toujours connectées.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#6e7d74] sm:text-lg sm:leading-8">
              Passage simplifie le suivi des entrées et sorties des élèves.
              Une information claire pour les équipes, une tranquillité d’esprit
              pour les parents.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-3 rounded-xl bg-[#1d4b3b] px-6 py-3.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(29,75,59,0.18)] transition hover:-translate-y-0.5 hover:bg-[#14392f]"
              >
                Accéder à mon espace
                <FontAwesomeIcon icon={faArrowRight} className="h-3.5 w-3.5" />
              </Link>
              <a
                href="#espaces"
                className="inline-flex items-center justify-center rounded-xl border border-[#dfe5da] bg-white/60 px-6 py-3.5 text-sm font-semibold text-[#42584d] transition hover:border-[#bac9bd] hover:bg-white"
              >
                Découvrir les espaces
              </a>
            </div>
            <div className="mt-8 flex items-center gap-3 text-xs text-[#87938b]">
              <span className="flex -space-x-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#f7f7f1] bg-[#f0dfb5] text-[10px] font-bold text-[#86661f]">R</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#f7f7f1] bg-[#d8e8dc] text-[10px] font-bold text-[#28634a]">A</span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#f7f7f1] bg-[#dce5ef] text-[10px] font-bold text-[#45627c]">P</span>
              </span>
              <span>Un outil pensé pour toute la communauté éducative</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[500px]">
            <div className="absolute -right-5 -top-5 h-28 w-28 rounded-full bg-[#e7cf91]/40 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-white p-5 shadow-[0_30px_90px_rgba(29,75,59,0.12)] sm:p-7">
              <div className="flex items-center justify-between border-b border-[#edf0e9] pb-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a7522]">Vue d’ensemble</p>
                  <h2 className="mt-1 text-lg font-semibold text-[#183b32]">Aujourd’hui à l’école</h2>
                </div>
                <span className="rounded-full bg-[#eaf1e9] px-3 py-1.5 text-[11px] font-semibold text-[#28634a]">En direct</span>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-[#f5f7f1] p-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#28634a] shadow-sm">
                    <FontAwesomeIcon icon={faSchool} className="h-4 w-4" />
                  </span>
                  <p className="mt-5 text-2xl font-semibold tracking-tight text-[#183b32]">École</p>
                  <p className="mt-1 text-xs text-[#839087]">Un suivi centralisé</p>
                </div>
                <div className="rounded-2xl bg-[#f8f4e9] p-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#a17a26] shadow-sm">
                    <FontAwesomeIcon icon={faShieldHalved} className="h-4 w-4" />
                  </span>
                  <p className="mt-5 text-2xl font-semibold tracking-tight text-[#183b32]">Serein</p>
                  <p className="mt-1 text-xs text-[#839087]">Des données protégées</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-[#163f35] p-5 text-white sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-medium text-white/60">Une seule plateforme</p>
                    <p className="mt-2 text-xl font-semibold leading-snug">Trois espaces,<br />un même objectif.</p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-[#f0ca70]">
                    <FontAwesomeIcon icon={faUsers} className="h-4 w-4" />
                  </span>
                </div>
                <div className="mt-6 flex h-2 overflow-hidden rounded-full bg-white/10">
                  <span className="w-1/3 bg-[#e6b84a]" />
                  <span className="w-1/3 bg-[#91bd9a]" />
                  <span className="w-1/3 bg-[#9cb7d1]" />
                </div>
                <div className="mt-3 flex justify-between text-[10px] text-white/60">
                  <span>Équipe éducative</span>
                  <span>Familles</span>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-3 rounded-xl border border-[#edf0e9] px-4 py-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eaf1e9] text-[#28634a]">
                  <FontAwesomeIcon icon={faWifi} className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold text-[#43564d]">Prêt pour le terrain</p>
                  <p className="mt-0.5 text-[11px] text-[#87938b]">Les passages restent disponibles hors ligne</p>
                </div>
              </div>
            </div>
            <span className="absolute -bottom-5 -left-5 hidden items-center gap-2 rounded-xl border border-white bg-white px-4 py-3 text-xs font-semibold text-[#42584d] shadow-lg sm:flex">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f8f0da] text-[#927021]">
                <FontAwesomeIcon icon={faClock} className="h-3.5 w-3.5" />
              </span>
              Suivi en temps réel
            </span>
          </div>
        </div>
      </section>

      <section className="border-y border-[#e9ebe3] bg-white/60 px-5 py-7 sm:px-8 lg:px-12">
        <div className="mx-auto grid max-w-7xl gap-5 sm:grid-cols-3 sm:gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf2e9] text-[#527963]">
                <FontAwesomeIcon icon={stat.icon} className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-[#354c41]">{stat.value}</p>
                <p className="mt-0.5 text-xs text-[#87938b]">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="espaces" className="px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-9 flex flex-col justify-between gap-4 sm:mb-12 sm:flex-row sm:items-end">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-[#9a7522]">Des espaces dédiés</p>
              <h2 className="text-3xl font-semibold tracking-tight text-[#183b32] sm:text-4xl">Tout le monde à sa place.</h2>
            </div>
            <p className="max-w-sm text-sm leading-6 text-[#718078]">
              Une interface adaptée à chaque personne, pour aller droit à l’essentiel.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {parcours.map((item, index) => (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-[1.5rem] border border-[#e4e6dc] bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-[#bdcbbd] hover:shadow-[0_18px_40px_rgba(29,75,59,0.08)] sm:p-7"
              >
                <div className="flex items-center justify-between">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.tone}`}>
                    <FontAwesomeIcon icon={item.icon} className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-semibold text-[#a0aaa2]">0{index + 1}</span>
                </div>
                <p className="mt-7 text-[11px] font-bold uppercase tracking-[0.12em] text-[#9a7522]">{item.label}</p>
                <h3 className="mt-2 text-xl font-semibold text-[#183b32]">{item.title}</h3>
                <p className="mt-2 min-h-[48px] text-sm leading-6 text-[#718078]">{item.description}</p>
                <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#28634a]">
                  Découvrir l’espace
                  <FontAwesomeIcon icon={faArrowUpRightFromSquare} className="h-3 w-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e4e6dc] px-5 py-6 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-xs text-[#87938b] sm:flex-row">
          <span>Afric&apos;Éduc · Passage</span>
          <span>Le suivi scolaire, en toute sérénité.</span>
        </div>
      </footer>
    </main>
  );
}
