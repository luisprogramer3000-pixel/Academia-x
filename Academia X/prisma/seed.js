const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Create or update Default Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'central' },
    update: {},
    create: {
      name: 'Academia X Central',
      slug: 'central',
      primaryColor: '#3B82F6',
      secondaryColor: '#1E293B',
      language: 'es'
    }
  });
  console.log('✅ Created Tenant:', tenant.name);

  // 1b. Create or update AI Credit Wallet for Default Tenant
  const wallet = await prisma.aICreditWallet.upsert({
    where: { tenantId: tenant.id },
    update: {},
    create: {
      tenantId: tenant.id,
      teacherCredits: 150,
      studentCredits: 0,
      monthlyTeacherAllowance: 150,
      monthlyStudentAllowance: 0,
      resetAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    }
  });
  console.log('✅ Created AI Credit Wallet for Tenant:', tenant.name);

  // 2. Create Super Admin User
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@academiax.com' },
    update: {},
    create: {
      email: 'admin@academiax.com',
      name: 'Super Admin',
      globalRole: 'SUPER_ADMIN',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'
    }
  });
  console.log('✅ Created Admin User:', adminUser.email);

  // 3. Create Owner Membership
  const membership = await prisma.membership.upsert({
    where: {
      userId_tenantId: {
        userId: adminUser.id,
        tenantId: tenant.id
      }
    },
    update: {},
    create: {
      userId: adminUser.id,
      tenantId: tenant.id,
      role: 'OWNER'
    }
  });
  console.log('✅ Created Membership for Admin');

  // 4. Create Initial Demo Course
  const course = await prisma.course.upsert({
    where: {
      tenantId_slug: {
        tenantId: tenant.id,
        slug: 'ingles-desde-cero'
      }
    },
    update: {},
    create: {
      tenantId: tenant.id,
      title: 'Inglés Intensivo desde Cero',
      slug: 'ingles-desde-cero',
      description: 'Aprende inglés estructurado desde nivel principiante (A1) hasta conversacional.',
      language: 'es',
      level: 'A1',
      status: 'PUBLISHED',
      priceAmount: 49.99,
      currency: 'USD'
    }
  });
  console.log('✅ Created Course:', course.title);

  // 5. Create Module & Lesson
  const module1 = await prisma.module.create({
    data: {
      courseId: course.id,
      title: 'Módulo 1: Introducción y Saludos',
      description: 'Fundamentos básicos de pronunciación y saludos en inglés.',
      order: 1,
      lessons: {
        create: [
          {
            title: 'Lección 1: Hello & Goodbye',
            order: 1,
            content: JSON.stringify({
              type: 'video_lesson',
              videoUrl: 'https://www.youtube.com/watch=dQw4w9WgXcQ',
              transcript: 'Bienvenido a la primera lección de inglés de Academia X.'
            })
          },
          {
            title: 'Lección 2: Presentaciones básicas (Verb To Be)',
            order: 2,
            content: JSON.stringify({
              type: 'grammar_lesson',
              text: 'Uso del verbo To Be: I am, You are, He/She/It is.'
            })
          }
        ]
      }
    }
  });
  console.log('✅ Created Module and Lessons');

  console.log('🎉 Database seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
