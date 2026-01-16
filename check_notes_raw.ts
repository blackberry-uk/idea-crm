import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const notes = await prisma.note.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10
    });
    console.log('--- Recent Notes ---');
    notes.forEach(note => {
        console.log(`Note ID: ${note.id}`);
        console.log(`  Content: ${note.content?.substring(0, 100)}...`);
        console.log(`  CreatedAt: ${note.createdAt}`);
        console.log(`  contactId: ${note.contactId}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
