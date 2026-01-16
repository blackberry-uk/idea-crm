import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const notesWithTags = await prisma.note.findMany({
        where: {
            OR: [
                { taggedContacts: { some: {} } },
                { contactId: { not: null } }
            ]
        },
        include: {
            taggedContacts: true,
            contact: true
        }
    });

    console.log('--- Notes with Contact Relationships ---');
    notesWithTags.forEach(note => {
        console.log(`Note ID: ${note.id}`);
        console.log(`  Content: ${note.content?.substring(0, 50)}...`);
        if (note.contact) {
            console.log(`  Direct Contact Relationship (Existing): ${note.contact.fullName || note.contact.firstName}`);
        } else if (note.contactId) {
            console.log(`  Direct Contact Relationship (BROKEN ID): ${note.contactId}`);
        }

        if (note.taggedContacts.length > 0) {
            note.taggedContacts.forEach(c => {
                console.log(`  Tagged Contact (Existing): ${c.fullName || c.firstName}`);
            });
        }
    });

    // Also check for raw IDs in the relationship tables (even if records are gone)
    // This is harder with Prisma but we can check the IDs in Note.contactId
    const notesWithBrokenIds = await prisma.note.findMany({
        where: {
            contactId: { not: null },
            contact: { is: null }
        }
    });

    if (notesWithBrokenIds.length > 0) {
        console.log('\n--- BROKEN RELATIONSHIPS DETECTED ---');
        notesWithBrokenIds.forEach(n => console.log(`Note ${n.id} points to missing contact ${n.contactId}`));
    }
}

main().catch(console.error).finally(() => prisma.$disconnect());
