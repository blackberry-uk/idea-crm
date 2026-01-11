import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    try {
        const user = await prisma.user.findFirst();
        if (!user) {
            console.log("No user found");
            return;
        }
        console.log("Creating test note...");
        const note = await prisma.note.create({
            data: {
                content: "Test note",
                createdById: user.id,
                taggedUsers: {
                    connect: [{ id: user.id }]
                }
            },
            include: {
                taggedUsers: true
            }
        });
        console.log("Success:", note);
    } catch (err) {
        console.error("Error:", err);
    } finally {
        await prisma.$disconnect();
    }
}

main();
