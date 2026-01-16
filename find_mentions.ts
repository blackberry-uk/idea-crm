import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const notes = await prisma.note.findMany({
        where: {
            content: {
                contains: '@'
            }
        }
    });

    console.log(`Found ${notes.length} notes with @ mentions.`);
    notes.forEach(note => {
        console.log(`Note ID: ${note.id}`);
        console.log(`Content: ${note.content}`);
        console.log('---');
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
