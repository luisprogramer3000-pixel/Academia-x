/**
 * Pone (o cambia) la contraseña de un administrador de la plataforma.
 *
 *   npx tsx scripts/set-admin-password.ts [correo]
 *
 * Pide la contraseña en la terminal (no se escribe en ningún archivo ni en el
 * historial). Por defecto, admin@mentorstudioglobal.com. Solo funciona con
 * usuarios SUPER_ADMIN.
 */
import { existsSync, readFileSync } from "fs";
import { createInterface } from "readline";

for (const file of [".env.local", ".env"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
}

/** Pregunta sin mostrar lo que se escribe. */
function askHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const output = rl as unknown as { _writeToOutput: (s: string) => void };
    let asked = false;
    output._writeToOutput = (s: string) => {
      if (!asked) {
        process.stdout.write(s);
        asked = true;
      } else if (s.includes("\n") || s.includes("\r")) process.stdout.write("\n");
    };
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  const email = (process.argv[2] || "admin@mentorstudioglobal.com").trim().toLowerCase();
  const { PrismaClient } = await import("@prisma/client");
  const { hashPassword, MIN_PASSWORD_LENGTH } = await import("../src/lib/password");
  const prisma = new PrismaClient();

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, globalRole: true } });
  if (!user) throw new Error(`No existe el usuario ${email}.`);
  if (user.globalRole !== "SUPER_ADMIN") throw new Error(`${email} no es administrador de la plataforma.`);

  const password = await askHidden(`Nueva contraseña para ${email}: `);
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  const repeat = await askHidden("Repítela: ");
  if (password !== repeat) throw new Error("Las contraseñas no coinciden.");

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
  await prisma.$disconnect();
  console.log(`Contraseña guardada. Ya puedes iniciar sesión como ${email}.`);
  process.exit(0);
}

main().catch((error) => {
  console.error("ERROR:", error instanceof Error ? error.message : error);
  process.exit(1);
});
