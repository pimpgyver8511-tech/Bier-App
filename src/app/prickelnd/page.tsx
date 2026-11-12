import { notFound, redirect } from "next/navigation";
import { getSparklingShareToken, isAdmin } from "@/lib/auth";

export const metadata = { robots: { index: false, follow: false } };

/**
 * Einstieg nur fuer den Admin: leitet auf die Sekt-Seite inkl. Link-Token
 * weiter, damit man den Link von dort kopieren und weitergeben kann. Fuer
 * alle anderen eine normale 404 - nirgends in der App verlinkt.
 */
export default async function SparklingEntryPage() {
  if (!(await isAdmin())) notFound();
  redirect(`/prickelnd/${getSparklingShareToken()}`);
}
