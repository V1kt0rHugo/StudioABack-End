const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const migrations = await prisma.$queryRawUnsafe('SELECT * FROM _prisma_migrations ORDER BY started_at DESC LIMIT 5');
  console.log(migrations);
}

main().catch(console.error).finally(() => prisma.$disconnect());
