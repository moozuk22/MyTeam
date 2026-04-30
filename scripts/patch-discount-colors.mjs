import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const patches = [
  { id: "c62c4ac9-ca8e-4bb1-ba8e-dbb6aad0887b", name: "Sport Depot",        themeColor: "#e63946" }, // red
  { id: "5bb984c9-1f4b-443f-b863-383c1acc52a4", name: "Innline Dragon Body", themeColor: "#d4a017" }, // yellow-gold
  { id: "c5a5f902-3733-4f95-a600-1145e8cb66cb", name: "Dalida Dance Show",   themeColor: "#c9a84c" }, // golden (already set, keeping it)
  { id: "807bcb60-e26a-4db2-9230-ebab997bca10", name: "Мебели Нико",         themeColor: "#2563eb" }, // blue
];

async function main() {
  for (const patch of patches) {
    await prisma.partnerDiscount.update({
      where: { id: patch.id },
      data: { themeColor: patch.themeColor },
    });
    console.log(`✓ ${patch.name} → ${patch.themeColor}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
