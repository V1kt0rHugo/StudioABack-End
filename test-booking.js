const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testBooking() {
  try {
    const client = await prisma.client.findFirst();
    if (!client) return console.log("Nenhum cliente no banco");

    const res = await fetch('http://localhost:3000/customer-service', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idClient: client.id,
        employeeId: "3a8ba031-e11a-467f-af01-891dec720b2c",
        Date: "2026-06-08T15:00:00",
        services: [
          { serviceId: "1528b65b-d993-4168-b743-3351bc72650b" } // TinturaId from .http
        ]
      })
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("Error:", data);
    } else {
      console.log("Success:", data);
    }
  } catch (err) {
    console.error("Fetch failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}
testBooking();
