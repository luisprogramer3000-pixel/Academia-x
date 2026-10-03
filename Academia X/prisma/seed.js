const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // 1. Create or update Default Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'central' },
    update: {},
    create: {
      name: 'Mentor Studio Global Central',
      slug: 'central',
      primaryColor: '#3B82F6',
      secondaryColor: '#F1F5F9',
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
    where: { email: 'admin@mentorstudioglobal.com' },
    update: {},
    create: {
      email: 'admin@mentorstudioglobal.com',
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

  // 5. Create Module & Lesson (idempotente: sin esto, cada ejecución del seed
  // duplicaba el módulo y sus lecciones en el mismo curso)
  const existingModule = await prisma.module.findFirst({
    where: { courseId: course.id, title: 'Módulo 1: Introducción y Saludos' },
    select: { id: true }
  });

  if (!existingModule) await prisma.module.create({
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
              transcript: 'Bienvenido a la primera lección de inglés de Mentor Studio Global.'
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

  await seedDemoAcademy();

  console.log('🎉 Database seeding completed successfully!');
}

/**
 * Academia de demostración "JL Global Institute" (/a/jl-institute).
 *
 * La landing enlaza este portal tres veces ("Ver Demostración VIP"), así que si
 * no existe, un visitante que llega desde la página de inicio se topa con un 404.
 * Es idempotente: se puede volver a ejecutar sin duplicar nada.
 *
 * No se crea ningún usuario propietario a propósito: nadie debe poder iniciar
 * sesión en la academia de demostración.
 */
async function seedDemoAcademy() {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'jl-institute' },
    update: {},
    create: {
      name: 'JL Global Institute',
      slug: 'jl-institute',
      primaryColor: '#2563eb',
      secondaryColor: '#F1F5F9',
      language: 'es'
    }
  });

  const demoCourses = [
    {
      slug: 'espanol-b2-negocios',
      title: 'Español Profesional B2 — Negocios e Industria',
      description: 'Curso avanzado de comunicación corporativa, negociación y protocolo de negocios en español.',
      level: 'B2',
      priceAmount: 149,
      modules: [
        {
          title: 'Módulo 1: Comunicación corporativa',
          description: 'Registro formal, correos y presentaciones ante clientes.',
          lessons: [
            {
              title: 'Lección 1: El correo profesional en español',
              blocks: [
                {
                  id: 'b1',
                  type: 'text',
                  content:
                    'En el español de negocios, el registro formal marca la diferencia. En esta lección trabajamos las fórmulas de apertura y cierre, el tratamiento de usted y la estructura de un correo de propuesta comercial.'
                },
                {
                  id: 'b2',
                  type: 'quiz',
                  question: '¿Cuál es el cierre más adecuado para una propuesta comercial formal?',
                  options: ['Un abrazo', 'Quedo a su disposición', 'Nos vemos', 'Saludos rápidos']
                }
              ]
            },
            {
              title: 'Lección 2: Negociación y concesiones',
              blocks: [
                {
                  id: 'b1',
                  type: 'text',
                  content:
                    'Vocabulario clave de negociación: margen, contrapartida, cláusula, acuerdo marco. Practicamos el lenguaje de la concesión sin perder posición.'
                }
              ]
            }
          ]
        },
        {
          title: 'Módulo 2: Protocolo y cultura de empresa',
          description: 'Diferencias culturales entre España y Latinoamérica.',
          lessons: [
            {
              title: 'Lección 3: Reuniones y jerarquías',
              blocks: [
                {
                  id: 'b1',
                  type: 'text',
                  content:
                    'Cómo se estructura una reunión formal, quién toma la palabra y cómo se expresa el desacuerdo sin romper la relación comercial.'
                }
              ]
            }
          ]
        }
      ]
    },
    {
      slug: 'ia-para-profesores-de-idiomas',
      title: 'IA para Profesores de Idiomas: De Cero a Creador de Cursos',
      description: 'Formación para docentes en el uso de Inteligencia Artificial aplicada a la enseñanza y creación de contenidos.',
      level: 'Todos los niveles',
      priceAmount: 199,
      modules: [
        {
          title: 'Módulo 1: Fundamentos',
          description: 'Qué puede y qué no puede hacer la IA en el aula de idiomas.',
          lessons: [
            {
              title: 'Lección 1: Diseñar un curso con el Copiloto',
              blocks: [
                {
                  id: 'b1',
                  type: 'text',
                  content:
                    'Partimos de un objetivo de aprendizaje alineado al MCER y dejamos que la IA proponga la secuencia didáctica. El criterio pedagógico sigue siendo tuyo: la IA acelera, no decide.'
                },
                {
                  id: 'b2',
                  type: 'quiz',
                  question: '¿Cuál es el primer paso al generar un curso con IA?',
                  options: [
                    'Definir el objetivo de aprendizaje y el nivel MCER',
                    'Pedir directamente 40 lecciones',
                    'Copiar un temario de internet',
                    'Grabar los vídeos'
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ];

  for (const courseData of demoCourses) {
    const course = await prisma.course.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: courseData.slug } },
      update: {},
      create: {
        tenantId: tenant.id,
        title: courseData.title,
        slug: courseData.slug,
        description: courseData.description,
        language: 'es',
        level: courseData.level,
        status: 'PUBLISHED',
        priceAmount: courseData.priceAmount,
        currency: 'USD'
      }
    });

    let order = 1;
    for (const moduleData of courseData.modules) {
      const existing = await prisma.module.findFirst({
        where: { courseId: course.id, title: moduleData.title },
        select: { id: true }
      });
      if (existing) {
        order++;
        continue;
      }

      await prisma.module.create({
        data: {
          courseId: course.id,
          title: moduleData.title,
          description: moduleData.description,
          order: order++,
          lessons: {
            create: moduleData.lessons.map((lesson, index) => ({
              title: lesson.title,
              order: index + 1,
              // El visor espera { blocks: [...] }; cualquier otro formato se muestra vacío
              content: JSON.stringify({ blocks: lesson.blocks })
            }))
          }
        }
      });
    }
  }

  console.log('✅ Demo academy ready at /a/jl-institute');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
