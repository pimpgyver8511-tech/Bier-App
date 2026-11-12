/**
 * Eigenes, schlichtes Layout fuer die Sekt-Seite: ohne die Navigation der
 * Mannschafts-App (Uebersicht, Bierangebote, Admin), die fuer Besucherinnen
 * dieser Seite keine Rolle spielt.
 */
export default function SparklingLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 mx-auto w-full max-w-3xl px-3 sm:px-6 py-4 sm:py-8">{children}</main>
  );
}
