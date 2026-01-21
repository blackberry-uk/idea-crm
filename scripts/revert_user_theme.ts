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

    // Remove the forced primary color and gold accent from customTheme
    // but keep the chosen follow-up colors
    const currentCustom = (user.customTheme as any) || {};
    const updatedCustom = { ...currentCustom };
    delete updatedCustom.primary;
    delete updatedCustom.accent;

    const currentAdj = (user.themeAdjustments as any) || {};
    const updatedAdj = { ...currentAdj };
    delete updatedAdj.primary;
    delete updatedAdj.accent;

    await prisma.user.update({
        where: { id: user.id },
        data: {
            customTheme: updatedCustom,
            themeAdjustments: updatedAdj
        }
    });

    console.log('User DB settings reverted: forced purple/gold removed, choosing to keep chosen follow-up colors.');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
