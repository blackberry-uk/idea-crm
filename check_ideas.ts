import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const ideas = await prisma.idea.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5
    });
    console.log('Recent Ideas:');
    ideas.forEach(i => {
        console.log(`ID: ${i.id}, Title: ${i.title}, ownerId: ${i.ownerId}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
