import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const ideas = await prisma.idea.findMany({
    orderBy: { createdAt: 'desc' },
    select: { ownerId: true, title: true, createdAt: true },
    take: 5
  });
  console.log("Recent Ideas:", ideas);
}
main().finally(() => prisma.$disconnect());
