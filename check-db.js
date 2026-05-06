const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clients = await prisma.client.findMany();
  console.dir(clients, { depth: null });
}
main().finally(() => prisma.$disconnect());
