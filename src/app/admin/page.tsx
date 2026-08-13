import { isAdmin } from "@/lib/auth";
import { loginAction } from "@/lib/actions";
import { prisma } from "@/lib/db";
import Link from "next/link";

async function LoginForm({ error }: { error?: string }) {
  return (
    <div className="max-w-sm mx-auto card p-6 space-y-4">
      <div className="text-center space-y-1">
        <p className="text-3xl">🔐🍺</p>
        <h1 className="text-xl font-bold">Admin-Login</h1>
        <p className="text-sm text-muted">Nur für den Kasten-Verwalter.</p>
      </div>
      <form action={loginAction} className="space-y-3">
        <input
          type="password"
          name="password"
          placeholder="Admin-Passwort"
          className="input"
          autoFocus
          required
        />
        {error && (
          <p className="text-sm text-danger">Falsches Passwort. Nochmal versuchen.</p>
        )}
        <button type="submit" className="btn btn-primary w-full">
          Anmelden
        </button>
      </form>
    </div>
  );
}

export default async function AdminPage({
  searchParams,
}: PageProps<"/admin">) {
  const admin = await isAdmin();
  const params = await searchParams;

  if (!admin) {
    return <LoginForm error={params.error as string | undefined} />;
  }

  const [playerCount, matchCount, openAssignments] = await Promise.all([
    prisma.player.count({ where: { active: true } }),
    prisma.match.count(),
    prisma.kastenAssignment.count({ where: { fulfilled: false } }),
  ]);

  const tiles = [
    {
      href: "/admin/matches",
      title: "Spiele",
      desc: "Spieltage anlegen, Anwesenheit pflegen, Kasten zuteilen",
      icon: "📅",
      stat: `${matchCount} Spiele`,
    },
    {
      href: "/admin/players",
      title: "Spieler",
      desc: "Kader verwalten",
      icon: "👥",
      stat: `${playerCount} aktiv`,
    },
    {
      href: "/admin/history",
      title: "Kasten-Historie",
      desc: "Begründungen pflegen, als erledigt markieren",
      icon: "📖",
      stat: `${openAssignments} offen`,
    },
    {
      href: "/admin/settings",
      title: "Einstellungen",
      desc: "Cooldown, Anzahl Kästen pro Spiel, Spielerplus-Sync",
      icon: "⚙️",
      stat: "",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Admin-Bereich</h1>
        <p className="text-muted text-sm mt-1">Willkommen zurück!</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="card p-5 hover:border-brand transition block">
            <div className="flex items-start justify-between">
              <span className="text-2xl">{t.icon}</span>
              {t.stat && <span className="badge badge-green">{t.stat}</span>}
            </div>
            <h2 className="font-bold text-lg mt-3">{t.title}</h2>
            <p className="text-sm text-muted mt-1">{t.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
