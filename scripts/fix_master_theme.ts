import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const user = await prisma.user.findFirst({
        where: { email: 'fernando.mora.uk@gmail.com' }
    });
    if (!user) {
        console.log('User not found');
        return;
    }

    const customTheme = (user.customTheme as any) || {};

    // If primary is the incorrect blackish slate, delete it to fallback to new default
    if (customTheme.primary === '#1e293b') {
        delete customTheme.primary;
    }

    await prisma.user.update({
        where: { id: user.id },
        data: {
            customTheme: customTheme,
            themeAdjustments: {} // Clear adjustments too to start fresh with new defaults
        }
    });

    console.log('User overrides cleaned up. Falling back to theme defaults.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
