import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const uid = 'cmk81u8ss0002jlj7rhmcotu5'; // test@example.com
  
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
  
  const todos = await prisma.dailyTodo.findMany({ where });
  console.log("Total for test@example.com:", todos.length);
}
main().finally(() => prisma.$disconnect());
