import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const notes = await prisma.note.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5,
            include: { taggedUsers: true }
        });
        console.log(JSON.stringify(notes, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
