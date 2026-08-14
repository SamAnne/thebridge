import { prisma } from '../db/connection'
import bcrypt from 'bcrypt';

async function main() {
    const adminRole = await prisma.role.findUnique({ where: { role: 'admin' } });
    const counselorRole = await prisma.role.findUnique({ where: { role: 'counselor' } });

    if (!adminRole || !counselorRole) {
        throw new Error('Roles not seeded correctly');
    }

    const adminPassword = await bcrypt.hash('adminpassword123', 10);
    const studentPassword = await bcrypt.hash('studentpassword123', 10);

    await prisma.user.upsert({
        where: { email: 'admin@example.com' },
        update: {},
        create: {
            email: 'admin@example.com',
            password: adminPassword,
            roleId: adminRole.id
        }
    });

    await prisma.user.upsert({
        where: { email: 'student@example.com' },
        update: {},
        create: {
            email: 'student@example.com',
            password: studentPassword,
            roleId: counselorRole.id
        }
    });

    console.log('Seeding complete');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());