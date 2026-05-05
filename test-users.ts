import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  users.forEach(u => console.log(u.email, u.id));
}
main().finally(() => prisma.$disconnect());
