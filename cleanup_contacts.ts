import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const deleted = await prisma.contact.deleteMany({
        where: { ownerId: null }
    });
    console.log(`Deleted ${deleted.count} orphaned contacts to enforce silo.`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
