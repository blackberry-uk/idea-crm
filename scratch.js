import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const notes = await prisma.note.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20
  });
  console.log(JSON.stringify(notes.map(n => ({ id: n.id, content: String(n.content).substring(0, 50), contactId: n.contactId, taggedContactIds: n.taggedContactIds })), null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
