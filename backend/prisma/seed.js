import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = [
    { name: 'Admin User', email: 'admin@aitest.dev', password: 'Admin@12345', role: 'ADMIN' },
    { name: 'Nihar Sawant', email: 'nihar@aitest.dev', password: 'Nihar@12345', role: 'QA_ENGINEER' },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, 10);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { name: u.name, email: u.email, passwordHash, role: u.role },
    });
    console.log(`Seeded ${u.role}: ${u.email} / ${u.password}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());