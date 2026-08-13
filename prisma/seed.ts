import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Kader-Liste, Stand Kader_2627.xlsm (Saison 26/27)
const players = [
  "Jonas Bocksch",
  "Niklas Cervinka",
  "Kevin Dau",
  "Rico Grundmann",
  "Philipp Helbig",
  "Andreas Hoffart",
  "Sascha Holfert",
  "Sebastian Kirmse",
  "Philipp Kluttig",
  "Theo Koch",
  "Matthias Molemans",
  "Simon Ogrisseck",
  "Jens Otto-Langhof",
  "Sebastian Pauly",
  "Patrick Pilz",
  "Manuel Rauscher",
  "Frank Richter",
  "Kevin Richter",
  "Felix Sander",
  "Armin Scheidig",
  "Stefan Schmidt",
  "Stefan Schreiber",
  "Bryan Sura",
  "Jesse Thalheim",
  "Philipp Wiehl",
  "Sebastian Zintzsch",
  "Jakob Hoffmann",
  "Alexander Pauly",
  "Felix Schmidt",
];

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const name of players) {
    await prisma.player.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log(`Fertig: ${players.length} Spieler geprüft/angelegt.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
