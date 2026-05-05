import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { updatedAt: 'desc' },
    select: { id: true, email: true, updatedAt: true }
  });
  console.log(users.slice(0, 5));
}
main().finally(() => prisma.$disconnect());
