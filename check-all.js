const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clients = await prisma.client.count();
  const employees = await prisma.employee.count();
  const services = await prisma.services.count();
  const products = await prisma.products.count();
  const customerServices = await prisma.customerService.count();
  const performedServices = await prisma.performedServices.count();
  const cashTransactions = await prisma.cashFlowTransaction.count();

  console.log('Clients:', clients);
  console.log('Employees:', employees);
  console.log('Services:', services);
  console.log('Products:', products);
  console.log('CustomerServices:', customerServices);
  console.log('PerformedServices:', performedServices);
  console.log('CashTransactions:', cashTransactions);
}
main().finally(() => prisma.$disconnect());
