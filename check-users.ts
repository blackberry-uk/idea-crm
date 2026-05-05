import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { email: 'fernando.mora.uk@gmail.com' }
  });
  console.log("Users:", users);
}
main().finally(() => prisma.$disconnect());
