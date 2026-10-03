import { prisma } from "@/lib/db";

/**
 * Analíticas del plan Academy Executive.
 *
 * Todo sale de datos reales del tenant. Nada está simulado: si un gráfico
 * aparece vacío es porque todavía no hay actividad ese mes.
 */

export interface MonthlyPoint {
  label: string;
  fullLabel: string;
  value: number;
}

const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTH_LONG = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** Los últimos `count` meses, del más antiguo al actual. */
function lastMonths(count: number) {
  const now = new Date();
  const months: Array<{ start: Date; end: Date; label: string; fullLabel: string }> = [];

  for (let i = count - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    months.push({
      start,
      end,
      label: MONTH_SHORT[start.getMonth()],
      fullLabel: `${MONTH_LONG[start.getMonth()]} ${start.getFullYear()}`,
    });
  }
  return months;
}

export class AnalyticsService {
  /**
   * Los tres gráficos del panel, calculados sobre los últimos 6 meses.
   */
  static async getMonthlyAnalytics(tenantId: string, monthCount = 6) {
    const months = lastMonths(monthCount);
    const from = months[0].start;

    const [enrollments, certificates, courses] = await Promise.all([
      // Inscripciones del periodo, con el precio del curso para valorarlas
      prisma.enrollment.findMany({
        where: { enrolledAt: { gte: from }, course: { tenantId } },
        select: { enrolledAt: true, course: { select: { priceAmount: true, currency: true } } },
      }),
      // Un certificado emitido = el profesor dio por completado el curso
      prisma.certificate.findMany({
        where: { tenantId, issuedAt: { gte: from } },
        select: { issuedAt: true },
      }),
      prisma.course.count({ where: { tenantId } }),
    ]);

    const inRange = (date: Date, i: number) => date >= months[i].start && date < months[i].end;

    const newStudents: MonthlyPoint[] = months.map((m, i) => ({
      label: m.label,
      fullLabel: m.fullLabel,
      value: enrollments.filter((e) => inRange(e.enrolledAt, i)).length,
    }));

    const completions: MonthlyPoint[] = months.map((m, i) => ({
      label: m.label,
      fullLabel: m.fullLabel,
      value: certificates.filter((c) => inRange(c.issuedAt, i)).length,
    }));

    const revenue: MonthlyPoint[] = months.map((m, i) => ({
      label: m.label,
      fullLabel: m.fullLabel,
      value: Math.round(
        enrollments
          .filter((e) => inRange(e.enrolledAt, i))
          .reduce((sum, e) => sum + Number(e.course.priceAmount), 0)
      ),
    }));

    const currency = enrollments.find((e) => Number(e.course.priceAmount) > 0)?.course.currency || "USD";

    return {
      newStudents,
      completions,
      revenue,
      currency,
      totals: {
        students: newStudents.reduce((n, p) => n + p.value, 0),
        completions: completions.reduce((n, p) => n + p.value, 0),
        revenue: revenue.reduce((n, p) => n + p.value, 0),
        courses,
      },
    };
  }
}
