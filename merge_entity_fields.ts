/**
 * Migration: Merge Entity.notes into Entity.description
 * For each entity where description is empty but notes has content, copy notes → description.
 * Then clear the notes field so we can drop it from the schema.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const entities = await (prisma.entity as any).findMany();
  console.log(`Found ${entities.length} entities`);

  let merged = 0;
  for (const entity of entities) {
    const desc = (entity.description || '').trim();
    const notes = (entity.notes || '').trim();

    if (!desc && notes) {
      // notes has content, description is empty → copy notes to description
      await (prisma.entity as any).update({
        where: { id: entity.id },
        data: { description: notes, notes: null }
      });
      console.log(`  ✅ ${entity.name}: copied notes → description`);
      merged++;
    } else if (desc && notes && desc !== notes) {
      // Both have different content → merge (description + notes)
      const combined = `${desc}\n\n${notes}`;
      await (prisma.entity as any).update({
        where: { id: entity.id },
        data: { description: combined, notes: null }
      });
      console.log(`  🔀 ${entity.name}: merged both fields`);
      merged++;
    } else if (desc && notes && desc === notes) {
      // Same content → just clear notes
      await (prisma.entity as any).update({
        where: { id: entity.id },
        data: { notes: null }
      });
      console.log(`  🟰 ${entity.name}: identical, cleared notes`);
      merged++;
    } else {
      console.log(`  ⏭️  ${entity.name}: nothing to merge`);
    }
  }

  console.log(`\nDone! Merged ${merged} of ${entities.length} entities.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
