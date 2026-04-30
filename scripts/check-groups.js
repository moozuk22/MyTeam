const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const scheduleGroups = await prisma.clubTrainingScheduleGroup.findMany({
    include: { club: true }
  })
  console.log('Schedule Groups:', JSON.stringify(scheduleGroups, null, 2))
}

main().finally(() => prisma.$disconnect())
