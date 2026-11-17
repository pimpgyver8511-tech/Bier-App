import { NavBar } from "@/components/NavBar";

/**
 * Layout fuer alle Seiten der Mannschafts-App (Navigation + Footer). Liegt
 * in einer eigenen Route-Gruppe, damit die nicht verlinkte Sekt-Seite unter
 * /prickelnd ohne diese Navigation auskommt - die URLs aendern sich durch
 * die Gruppe nicht.
 */
export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="print:hidden">
        <NavBar />
      </div>
      <main className="flex-1 mx-auto w-full max-w-5xl px-4 sm:px-6 py-6 sm:py-8">{children}</main>
      <footer className="text-center text-xs text-muted py-6 print:hidden">🍺 Bier App</footer>
    </>
  );
}
