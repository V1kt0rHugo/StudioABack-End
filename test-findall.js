const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const whereClause = {
      email: { not: { endsWith: '@anonimo.com' } },
    };

    const clients = await prisma.client.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          birthDate: true,
          notes: true,
        },
        skip: 0,
        take: 50,
    });
    console.log("Clients found via whereClause:", clients);
}
main().finally(() => prisma.$disconnect());
