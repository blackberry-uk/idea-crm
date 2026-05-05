import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const uid = 'cmk6pk7i600007qwl6lvep5hz'; // fernando
  
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
  
  try {
    const todos = await prisma.dailyTodo.findMany({ where, select: { id: true, date: true, text: true } });
    console.log(todos);
  } catch(e) {
    console.error(e);
  }
}
main().finally(() => prisma.$disconnect());
