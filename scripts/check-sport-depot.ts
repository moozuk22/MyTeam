import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function check() {
  const d = await prisma.partnerDiscount.findFirst({
    where: { name: { contains: "Sport Depot" } }
  });
  console.log("SPORT_DEPOT_DATA:", JSON.stringify(d, null, 2));
}

check();
