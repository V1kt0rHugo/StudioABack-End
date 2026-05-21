const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();
async function main() {
  const hash = await bcrypt.hash('Password123!', 10);
  const manager = await prisma.employee.create({
    data: {
      name: 'Andreia Cazula',
      email: 'andreacazula@gmail.com',
      password: hash,
      CPF: '222.333.444-55',
      phone: '(11) 97654-3210',
      commissionPercentage: 50,
      role: 'MANAGER'
    }
  });
  console.log('Manager criado com sucesso:', manager.email);
}
main().catch(console.error).finally(() => prisma.$disconnect());
