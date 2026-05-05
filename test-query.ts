import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({ take: 1 });
  const uid = users[0].id;
  
  const from = new Date(); from.setDate(from.getDate() - 14);
  const to = new Date(); to.setDate(to.getDate() + 14);
  
  const dateFilter: any = { gte: from, lte: to };
  
  const baseWhere = {
    parentId: null,
    OR: [
      { userId: uid },
      { assigneeId: uid },
      { idea: { OR: [{ ownerId: uid }, { collaborators: { some: { id: uid } } }] } }
    ]
  };
  
  const where: any = { ...baseWhere };
  where.AND = [
    { OR: [{ date: dateFilter }, { date: null }] }
  ];
  
  console.log("Where clause:", JSON.stringify(where, null, 2));

  try {
    const todos = await prisma.dailyTodo.findMany({ where });
    console.log("Count new where:", todos.length);
    
    const oldWhere: any = { userId: uid, parentId: null, OR: [{date: dateFilter}, {date: null}] };
    const oldTodos = await prisma.dailyTodo.findMany({ where: oldWhere });
    console.log("Count old where:", oldTodos.length);
  } catch(e) {
    console.error(e);
  }
}
main().finally(() => prisma.$disconnect());
