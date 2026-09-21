# MODELO DE DATOS E ENTIDADES - ACADEMIA X

## 1. Entidades Principales y Relaciones

El esquema de base de datos está diseñado en PostgreSQL utilizando Prisma ORM.

```prisma
// schema.prisma (Propuesto Inicial)

enum GlobalRole {
  SUPER_ADMIN
  USER
}

enum AcademyRole {
  OWNER
  TEACHER
  STUDENT
}

enum CourseStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

model User {
  id            String       @id @default(cuid())
  email         String       @unique
  name          String?
  passwordHash  String?
  avatarUrl     String?
  globalRole    GlobalRole   @default(USER)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  memberships   Membership[]
  submissions   Submission[]
  aiUsages      AIUsage[]
  auditLogs     AuditLog[]
}

model Tenant {
  id            String       @id @default(cuid())
  name          String
  slug          String       @unique
  customDomain  String?      @unique
  logoUrl       String?
  primaryColor  String       @default("#3B82F6")
  secondaryColor String      @default("#1E293B")
  language      String       @default("es")
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  memberships   Membership[]
  courses       Course[]
  certificates  Certificate[]
  subscriptions Subscription[]
  aiUsages      AIUsage[]
  auditLogs     AuditLog[]
  invitations   Invitation[]
}

model Membership {
  id        String      @id @default(cuid())
  userId    String
  tenantId  String
  role      AcademyRole @default(STUDENT)
  createdAt DateTime    @default(now())

  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  tenant    Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  enrollments Enrollment[]

  @@unique([userId, tenantId])
  @@index([tenantId])
}

model Course {
  id          String       @id @default(cuid())
  tenantId    String
  title       String
  slug        String
  description String?
  language    String       @default("es")
  level       String       @default("A1")
  status      CourseStatus @default(DRAFT)
  priceAmount Decimal      @default(0.00)
  currency    String       @default("USD")
  imageUrl    String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  tenant      Tenant       @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  modules     Module[]
  enrollments Enrollment[]
  certificates Certificate[]

  @@unique([tenantId, slug])
  @@index([tenantId])
}

model Module {
  id          String   @id @default(cuid())
  courseId    String
  title       String
  description String?
  order       Int      @default(0)
  createdAt   DateTime @default(now())

  course      Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  lessons     Lesson[]
}

model Lesson {
  id          String   @id @default(cuid())
  moduleId    String
  title       String
  order       Int      @default(0)
  content     Json?    // Bloques de contenido flexible (text, video, quiz, audio)
  createdAt   DateTime @default(now())

  module      Module   @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  assignments Assignment[]
  progresses  Progress[]
}

model Enrollment {
  id           String     @id @default(cuid())
  membershipId String
  courseId     String
  enrolledAt   DateTime   @default(now())

  membership   Membership @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  course       Course     @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@unique([membershipId, courseId])
}

model Progress {
  id        String   @id @default(cuid())
  userId    String
  lessonId  String
  completed Boolean  @default(false)
  updatedAt DateTime @updatedAt

  lesson    Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)

  @@unique([userId, lessonId])
}

model Assignment {
  id          String   @id @default(cuid())
  lessonId    String
  title       String
  description String
  createdAt   DateTime @default(now())

  lesson      Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  submissions Submission[]
}

model Submission {
  id           String     @id @default(cuid())
  assignmentId String
  userId       String
  content      String
  grade        String?
  feedback     String?
  createdAt    DateTime   @default(now())

  assignment   Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  user         User       @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Certificate {
  id             String   @id @default(cuid())
  tenantId       String
  userId         String
  courseId       String
  code           String   @unique // Hash único de verificación pública
  issuedAt       DateTime @default(now())

  tenant         Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  course         Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)

  @@index([tenantId])
}

model AIUsage {
  id           String   @id @default(cuid())
  tenantId     String
  userId       String
  feature      String   // e.g. "COURSE_GENERATOR", "LESSON_GENERATOR"
  provider     String   // e.g. "openai", "anthropic", "google"
  model        String   // e.g. "gpt-4o", "claude-3-5-sonnet"
  promptTokens Int
  completionTokens Int
  estimatedCost Decimal @default(0.0000)
  createdAt    DateTime @default(now())

  tenant       Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([tenantId])
}

model Subscription {
  id                   String   @id @default(cuid())
  tenantId             String
  stripeCustomerId     String?
  stripeSubscriptionId String?  @unique
  planId               String   // STARTER, PRO, ACADEMY
  status               String   // active, trialing, canceled
  currentPeriodEnd     DateTime
  createdAt            DateTime @default(now())

  tenant               Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
}

model Invitation {
  id        String      @id @default(cuid())
  tenantId  String
  email     String
  role      AcademyRole @default(STUDENT)
  token     String      @unique
  expiresAt DateTime
  createdAt DateTime    @default(now())

  tenant    Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}

model AuditLog {
  id        String   @id @default(cuid())
  tenantId  String?
  userId    String?
  action    String   // e.g. "TENANT_ACCESS_BLOCKED", "COURSE_DELETED"
  details   Json?
  ipAddress String?
  createdAt DateTime @default(now())

  tenant    Tenant?  @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user      User?    @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```
