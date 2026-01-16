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

    const mentions = new Set<string>();
    const regex = /@[\w\s.-]+(?=[,.;:!?"'\}\] \n]|$)/g;
    // I need a better way to extract just the "name" part without over-matching.
    // Since I know the names are usually followed by a space or punctuation:

    notes.forEach(note => {
        if (!note.content) return;
        // Let's use a simpler extraction for the list: @ followed by non-punctuation
        const matches = note.content.match(/@[^,.;:!?"'\}\]\n\\]+/g);
        if (matches) {
            matches.forEach(m => mentions.add(m.trim()));
        }
    });

    console.log('Detected mentions (names might be long due to greedy match):');
    mentions.forEach(m => console.log(m));
}

main().catch(console.error).finally(() => prisma.$disconnect());
