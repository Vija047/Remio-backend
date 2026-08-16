const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Adding password_hash column...');
  await prisma.$executeRawUnsafe(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255) NOT NULL DEFAULT ''`);
  const cols = await prisma.$queryRawUnsafe(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='users' ORDER BY ordinal_position`);
  console.log('columns after:', cols);
  await prisma.$executeRawUnsafe(`ALTER TABLE public.users ALTER COLUMN password_hash DROP DEFAULT`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('Error:', e);
  await prisma.$disconnect();
  process.exit(1);
});
