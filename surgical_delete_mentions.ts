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

    console.log(`Processing ${notes.length} notes with surgical regex...`);

    for (const note of notes) {
        if (!note.content) continue;

        const originalContent = note.content;

        // Surgical regex:
        // Matches optional space + @ + a Capitalized word + optional subsequent Capitalized words.
        // This stops at the first lowercase word (like "at", "on", "is", "mentioned").
        const capitalizedMentions = /\s?@([A-Z]\w*(?:\s+[A-Z]\w*)*)/g;

        // Also include specific common lowercase ones we found in this project
        const lowercaseMentions = /\s?@(dann|s)(?=\W|$)/g;

        let newContent = originalContent.replace(capitalizedMentions, (match) => {
            console.log(`Removing from Note ${note.id}: "${match}"`);
            return '';
        });

        newContent = newContent.replace(lowercaseMentions, (match) => {
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

    console.log('Finished surgical deletion of contact mentions.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
