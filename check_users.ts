import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany();
    console.log('Users:');
    users.forEach(u => console.log(`ID: ${u.id}, Name: ${u.name}, Email: ${u.email}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
