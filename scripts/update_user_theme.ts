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

    // Update follow-up colors and name the theme adjustments
    await prisma.user.update({
        where: { id: user.id },
        data: {
            customTheme: {
                ...(user.customTheme as object || {}),
                followUp: '#fffaf0',
                followUpBorder: '#d2b48c',
                primary: '#623086'
            },
            themeAdjustments: {
                followUp: { base: 'FloralWhite', l: 97, s: 100 },
                followUpBorder: { base: 'Tan', l: 77, s: 44 },
                primary: { base: 'Purple', l: 36, s: 47 }
            }
        }
    });

    console.log('User theme updated to Nazareno de San Pablo style');
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
