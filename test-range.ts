import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const uid = 'cmk6pk7i600007qwl6lvep5hz'; // Fernando's ID
  
  const from = new Date(); from.setDate(from.getDate() - 14);
  const to = new Date(); to.setDate(to.getDate() + 14);
  
  const todos = await prisma.dailyTodo.findMany({
    where: {
      userId: uid,
      parentId: null,
      date: { gte: from, lte: to }
    }
  });
  console.log("Fernando's tasks in date range:", todos.length);
  
  const allTodos = await prisma.dailyTodo.findMany({
    where: { userId: uid }
  });
  console.log("Fernando's total tasks:", allTodos.length);
}
main().finally(() => prisma.$disconnect());
