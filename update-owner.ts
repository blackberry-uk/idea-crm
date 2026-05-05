import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  if (users.length === 0) return;
  const uid = users[0].id;
  
  console.log("Updating to user:", users[0].email, uid);
  
  const res1 = await prisma.dailyTodo.updateMany({
    data: {
      assigneeId: uid
    }
  });
  console.log("Updated assigneeId:", res1.count);

  const completed = await prisma.dailyTodo.findMany({ where: { completed: true } });
  for (const t of completed) {
    await prisma.dailyTodo.update({
      where: { id: t.id },
      data: { completedById: uid }
    });
  }
  console.log("Updated completedById:", completed.length);
}
main().finally(() => prisma.$disconnect());
