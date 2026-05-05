import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { email: 'fernando.mora.uk@gmail.com' }
  });
  if (!user) return console.log('User not found');
  
  console.log("Routing all tasks to:", user.email);
  
  const res = await prisma.dailyTodo.updateMany({
    data: {
      userId: user.id,
      assigneeId: user.id
    }
  });
  console.log("Updated tasks:", res.count);
}
main().finally(() => prisma.$disconnect());
