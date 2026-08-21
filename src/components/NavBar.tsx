import Link from "next/link";
import Image from "next/image";
import { Outfit } from "next/font/google";
import { isAdmin } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";

const outfit = Outfit({ subsets: ["latin"], weight: ["600", "700"] });

export async function NavBar() {
  const admin = await isAdmin();

  return (
    <header className="bg-brand-dark text-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
        <Link
          href="/"
          className={`${outfit.className} flex items-center gap-2 font-bold text-lg tracking-tight`}
        >
          <Image
            src="/tus-leutzsch-crest.png"
            alt=""
            width={36}
            height={36}
            className="rounded-lg shrink-0"
          />
          Bier App
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2 text-sm">
          <Link href="/" className="px-3 py-1.5 rounded-lg hover:bg-white/10 transition">
            Übersicht
          </Link>
          <Link href="/angebote" className="px-3 py-1.5 rounded-lg hover:bg-white/10 transition">
            Bierangebote der Woche
          </Link>
          {admin ? (
            <>
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-lg bg-gold text-[#3a2404] font-semibold hover:brightness-105 transition"
              >
                Admin
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg hover:bg-white/10 transition"
                >
                  Abmelden
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/admin"
              className="px-3 py-1.5 rounded-lg border border-white/40 hover:bg-white/10 transition"
            >
              Admin-Login
            </Link>
          )}
        </nav>
      </div>
      <div className="hop-divider" />
    </header>
  );
}
