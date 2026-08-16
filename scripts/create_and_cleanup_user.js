const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = `test+${Date.now()}@example.com`;
  const user = await prisma.user.create({
    data: {
      name: 'Test User',
      email,
      passwordHash: 'hash123',
      settings: { create: {} },
    },
  });
  console.log('created:', user);
  const found = await prisma.user.findUnique({ where: { email } });
  console.log('found:', found);
  await prisma.user.delete({ where: { id: user.id } });
  console.log('deleted test user');
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
