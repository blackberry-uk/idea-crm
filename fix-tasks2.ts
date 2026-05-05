import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'fernando.mora.uk@gmail.com' }
  });
  if (!user) return console.log('User not found');
  
  const completed = await prisma.dailyTodo.findMany({ where: { completed: true } });
  for (const t of completed) {
    await prisma.dailyTodo.update({
      where: { id: t.id },
      data: { completedById: user.id }
    });
  }
  console.log("Updated completedById for", completed.length, "tasks to", user.email);
}
main().finally(() => prisma.$disconnect());
