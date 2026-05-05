import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const counts = await prisma.dailyTodo.groupBy({
    by: ['userId'],
    _count: {
      id: true
    }
  });
  console.log(counts);
}
main().finally(() => prisma.$disconnect());
