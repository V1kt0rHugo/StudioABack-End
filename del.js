const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clients = await prisma.client.findMany();
  let deletedCount = 0;
  for (const c of clients) {
    const services = await prisma.customerService.findMany({ where: { idClient: c.id } });
    for (const s of services) {
      await prisma.consumedItems.deleteMany({ where: { idCustomerService: s.id } });
      await prisma.performedServices.deleteMany({ where: { idCustomerService: s.id } });
      await prisma.cashFlowTransaction.deleteMany({ where: { idCustomerService: s.id } });
      await prisma.customerService.deleteMany({ where: { id: s.id } });
    }
    await prisma.client.delete({ where: { id: c.id } });
    deletedCount++;
  }
  console.log(`Clientes e seus respectivos agendamentos deletados: ${deletedCount}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
