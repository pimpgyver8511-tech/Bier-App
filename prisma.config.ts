import "dotenv/config";
import { defineConfig } from "prisma/config";

// Bewusst process.env statt des env()-Helfers: "prisma generate" (u.a. im
// postinstall-Hook) braucht keine echte DB-Verbindung und soll deshalb nicht
// scheitern, falls DATABASE_URL in diesem Schritt (noch) nicht sichtbar ist.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
