import "dotenv/config";
import { prisma } from "../src/lib/db";
import { backfillTrainingImages } from "../src/lib/exercise/imageBackfill";

async function main() {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error("DATABASE_URL is required.");
  const target = new URL(rawUrl);
  const host = target.hostname;
  const database = decodeURIComponent(target.pathname.slice(1));
  console.log(JSON.stringify({ host, database }));
  const args = process.argv.slice(2);
  const option = (name: string) => args[args.indexOf(name) + 1];
  if (!args.includes("--apply")) {
    console.log("No records changed. Use --apply --expected-host HOST --expected-database NAME after deployment.");
    return;
  }
  if (!args.includes("--expected-host") || !args.includes("--expected-database") ||
      option("--expected-host") !== host || option("--expected-database") !== database)
    throw new Error("The expected database host and name must match DATABASE_URL.");
  if (!host.endsWith(".neon.tech") && !args.includes("--allow-production"))
    throw new Error("A non-Neon target requires --allow-production and explicit operator authorization.");
  console.log(JSON.stringify(await backfillTrainingImages()));
}
main().catch(() => {
  // Connection errors can contain credentials. Do not print the error object.
  console.error("Image backfill failed. Check the target, migration state, and saved drawings. Completed records remain valid. The command can run again.");
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
