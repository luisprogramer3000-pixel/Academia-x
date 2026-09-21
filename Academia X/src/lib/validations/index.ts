import { z } from "zod";

/**
 * Esquemas Zod reutilizables y estrictos para validación de entradas del cliente
 */

export const tenantIdSchema = z.string().min(1, "Tenant ID es requerido").regex(/^[a-zA-Z0-9_-]+$/, "Formato de Tenant ID inválido");

export const userIdSchema = z.string().min(1, "User ID es requerido");

export const emailSchema = z.string().email("Correo electrónico inválido");

export const planIdSchema = z.enum(["STARTER", "PRO", "ACADEMY"], {
  errorMap: () => ({ message: "Plan ID no válido. Debe ser STARTER, PRO o ACADEMY" }),
});

export const creditAmountSchema = z.number().int("El número de créditos debe ser un entero").positive("La cantidad de créditos debe ser positiva");

export const aiOperationSchema = z.string().min(1, "La operación de IA es requerida");

export const topupPackageIdSchema = z.enum([
  "TEACHER_TOPUP_50",
  "TEACHER_TOPUP_150",
  "TEACHER_TOPUP_500",
  "STUDENT_TOPUP_100",
  "STUDENT_TOPUP_500",
], {
  errorMap: () => ({ message: "Paquete de Top-Up inválido" }),
});

export const purchaseIdSchema = z.string().min(1, "ID de compra requerido");

export const subscriptionIdSchema = z.string().min(1, "ID de suscripción requerido");

export const courseCreateSchema = z.object({
  title: z.string().min(3, "El título debe tener al menos 3 caracteres"),
  description: z.string().optional(),
  level: z.string().optional(),
});
