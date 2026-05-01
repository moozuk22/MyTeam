/* eslint-disable no-console */
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const clubs = await prisma.club.findMany({
    select: { id: true },
  });

  console.log(`Processing ${clubs.length} clubs...`);

  for (const club of clubs) {
    const allLogs = await prisma.paymentLog.findMany({
      where: { player: { clubId: club.id } },
      select: { paidFor: true },
      orderBy: { paidFor: "asc" },
    });

    if (allLogs.length > 0) {
      const minPaidFor = allLogs[0].paidFor;

      await prisma.club.update({
        where: { id: club.id },
        data: {
          billingStatus: "active",
          firstBillingMonth: minPaidFor,
          billingActivatedAt: new Date(),
        },
      });

      console.log(`Club ${club.id}: active, firstBillingMonth = ${minPaidFor.toISOString()}`);

      const players = await prisma.player.findMany({
        where: { clubId: club.id },
        select: {
          id: true,
          paymentLogs: {
            select: { paidFor: true },
            orderBy: { paidFor: "asc" },
            take: 1,
          },
        },
      });

      for (const player of players) {
        const playerFirstBillingMonth =
          player.paymentLogs.length > 0 ? player.paymentLogs[0].paidFor : minPaidFor;

        await prisma.player.update({
          where: { id: player.id },
          data: { firstBillingMonth: playerFirstBillingMonth },
        });
      }

      console.log(`  Updated ${players.length} players`);
    } else {
      await prisma.club.update({
        where: { id: club.id },
        data: {
          billingStatus: "demo",
          firstBillingMonth: null,
          billingActivatedAt: null,
        },
      });
      console.log(`Club ${club.id}: demo (no payment logs)`);
    }
  }

  console.log("Backfill complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
