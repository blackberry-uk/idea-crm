
// @ts-ignore - PrismaClient is a generated class and might not be recognized as an exported member by the compiler
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const ideaCount = await prisma.idea.count();
  if (ideaCount > 0) {
    console.log('Database already contains data. Skipping seed to prevent duplicates.');
    return;
  }

  console.log('Seeding database...');

  const idea1 = await prisma.idea.create({
    data: {
      title: 'AI Personal Stylist',
      oneLiner: 'Hyper-personalized fashion recommendations using vision models.',
      status: 'Active',
      tags: JSON.stringify(['AI', 'B2C', 'Fashion']),
      priority: 5,
    },
  });

  const contact1 = await prisma.contact.create({
    data: {
      fullName: 'Sarah Chen',
      org: 'Venture Capital Partners',
      role: 'Associate',
      email: 'sarah@vcp.com',
      phone: '+1 555-0123',
      country: 'USA',
      linkedinUrl: 'https://linkedin.com/in/sarahchen',
      relationshipStrength: 4,
    },
  });

  await prisma.note.create({
    data: {
      body: 'Need to research high-quality fashion datasets.',
      ideaId: idea1.id,
      createdBy: 'System Seed',
    },
  });

  console.log('Seed completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    // Use the global process.exit to terminate with a failure code if an error occurs during seeding.
    // Fixed: Cast process to any to access the exit method which might be missing from the environment's Process type definition
    if (typeof process !== 'undefined') {
      (process as any).exit(1);
    }
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
