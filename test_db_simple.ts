import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    console.log("Checking database connection...");
    try {
        const userCount = await prisma.user.count();
        console.log("Connection successful! User count:", userCount);
    } catch (err: any) {
        console.error("Database connection failed:", err.message);
        if (process.env.DATABASE_URL) {
            console.log("DATABASE_URL is set (masked):", process.env.DATABASE_URL.substring(0, 15) + "...");
        } else {
            console.log("DATABASE_URL is NOT set in environment.");
        }
    } finally {
        await prisma.$disconnect();
    }
}
main();
