import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const contacts = await prisma.contact.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10
    });
    console.log('Recent Contacts:');
    contacts.forEach(c => {
        console.log(`ID: ${c.id}, Name: ${c.firstName} ${c.lastName}, ownerId: ${c.ownerId}`);
    });
}

main().catch(console.error).finally(() => prisma.$disconnect());
