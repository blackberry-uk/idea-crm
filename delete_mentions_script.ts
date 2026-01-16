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

    console.log(`Processing ${notes.length} notes...`);

    for (const note of notes) {
        if (!note.content) continue;

        // Regex to find @ mentions. It attempts to match @ followed by words and spaces,
        // stopping before common punctuation or JSON structure characters.
        // We also try to catch the trailing space if it exists.
        const originalContent = note.content;
        const newContent = originalContent.replace(/\s?@[\w\s.-]+(?=[,.;:!?"'\}\] \n]|$)/g, (match) => {
            console.log(`Removing from Note ${note.id}: "${match}"`);
            return '';
        });

        if (originalContent !== newContent) {
            await prisma.note.update({
                where: { id: note.id },
                data: { content: newContent }
            });
        }
    }

    console.log('Finished deleting text mentions.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
