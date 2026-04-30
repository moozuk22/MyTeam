import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function check() {
  const player = await prisma.player.findFirst({
    where: { fullName: { contains: "Алек Константинов" } },
    select: { id: true, fullName: true, teamGroup: true, clubId: true }
  });

  console.log("PLAYER:", player);

  if (player) {
    const configs = await prisma.teamDiscountConfig.findMany({
      where: { clubId: player.clubId },
      include: { discount: true }
    });
    console.log("ALL CONFIGS FOR CLUB:", JSON.stringify(configs, null, 2));
  }
}

check();
