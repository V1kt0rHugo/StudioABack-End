const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.employee.update({
    where: { email: 'andreacazula@gmail.com' },
    data: { role: 'MANAGER' }
  });
  console.log("Updated Andreia to MANAGER.");
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
