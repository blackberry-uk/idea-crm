import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const orphans = await prisma.contact.findMany({
        where: { ownerId: null }
    });

    const targetUser = await prisma.user.findUnique({
        where: { email: 'fernando.mora.uk@gmail.com' }
    });

    if (!targetUser) {
        console.log('User not found');
        return;
    }

    if (orphans.length === 0) {
        console.log('No orphaned contacts found.');
        return;
    }

    const updated = await prisma.contact.updateMany({
        where: { ownerId: null },
        data: { ownerId: targetUser.id }
    });

    console.log(`Successfully assigned ${updated.count} contacts to ${targetUser.email}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
