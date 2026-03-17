import { randomBytes, scryptSync } from "crypto";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${key}`;
}

async function main() {
  const adminPassword = process.env.ADMIN_PASSWORD;
  const coachPassword = process.env.COACH_PASSWORD;

  if (!adminPassword || !coachPassword) {
    throw new Error("Missing ADMIN_PASSWORD and/or COACH_PASSWORD in .env");
  }

  const prisma = new PrismaClient();
  try {
    await prisma.user.deleteMany();
    await prisma.user.createMany({
      data: [
        {
          password: hashPassword(adminPassword),
          roles: ["admin", "coach"],
        },
        {
          password: hashPassword(coachPassword),
          roles: ["coach"],
        },
      ],
    });
    console.log("Seeded users table with admin+coach and coach accounts.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
