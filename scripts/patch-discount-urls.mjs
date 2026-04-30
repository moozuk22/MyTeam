import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const patches = [
  // Sport Depot already has storeUrl set, but included here in case you want to change it
  { id: "c62c4ac9-ca8e-4bb1-ba8e-dbb6aad0887b", name: "Sport Depot",        storeUrl: "https://sportdepot.bg" },
  { id: "5bb984c9-1f4b-443f-b863-383c1acc52a4", name: "Innline Dragon Body", storeUrl: "https://innlinedragonbody.com" }, // ← add URL here if they have a website
  { id: "c5a5f902-3733-4f95-a600-1145e8cb66cb", name: "Dalida Dance Show",   storeUrl: "https://dalidadance.com" }, // ← add URL here if they have a website
  { id: "807bcb60-e26a-4db2-9230-ebab997bca10", name: "Мебели Нико",         storeUrl: "https://mebeliniko.bg" }, // ← add URL here if they have a website
];

async function main() {
  for (const patch of patches) {
    await prisma.partnerDiscount.update({
      where: { id: patch.id },
      data: { storeUrl: patch.storeUrl },
    });
    console.log(`✓ ${patch.name} → ${patch.storeUrl ?? "(no website)"}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
