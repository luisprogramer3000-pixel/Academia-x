import { prisma } from "@/lib/db";
import { partsInTimezone, safeTimezone, zonedTimeToUtc } from "@/lib/timezone";

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

/**
 * Los últimos `count` meses de la academia, del más antiguo al actual. Cada mes
 * empieza el día 1 a las 00:00 en la zona horaria de la academia.
 */
function lastMonths(count: number, tz: string) {
  const today = partsInTimezone(new Date(), tz);
  const months: Array<{ start: Date; key: string; label: string; fullLabel: string }> = [];

  for (let i = count - 1; i >= 0; i--) {
    const index = today.year * 12 + today.month - i;
    const year = Math.floor(index / 12);
    const month = index % 12;
    months.push({
      start: zonedTimeToUtc(year, month, 1, 0, 0, tz),
      key: `${year}-${String(month + 1).padStart(2, "0")}`,
      label: MONTH_SHORT[month],
      fullLabel: `${MONTH_LONG[month]} ${year}`,
    });
  }
  return months;
}

export class AnalyticsService {
  /**
   * Los tres gráficos del panel, calculados sobre los últimos 6 meses.
   */
  static async getMonthlyAnalytics(tenantId: string, monthCount = 6, timezone?: string | null) {
    // Los meses se cortan en la zona horaria de la academia (no la del servidor, que en producción es UTC)
    const tz = safeTimezone(timezone);
    const months = lastMonths(monthCount, tz);
    const from = months[0].start;

    // La base de datos agrupa y suma por mes: viajan como mucho `monthCount` filas
    // por consulta, no todas las inscripciones y certificados del periodo.
    const [enrollmentRows, certificateRows, currencyRow, courses] = await Promise.all([
      prisma.$queryRaw<Array<{ month: string; n: bigint; revenue: string | null }>>`
        SELECT to_char(e."enrolledAt" AT TIME ZONE ${tz}, 'YYYY-MM') AS month,
               count(*)::bigint AS n,
               sum(c."priceAmount")::text AS revenue
        FROM "Enrollment" e JOIN "Course" c ON c."id" = e."courseId"
        WHERE c."tenantId" = ${tenantId} AND c."deletedAt" IS NULL AND e."enrolledAt" >= ${from}
        GROUP BY 1`,
      // Un certificado emitido = el profesor dio por completado el curso
      prisma.$queryRaw<Array<{ month: string; n: bigint }>>`
        SELECT to_char("issuedAt" AT TIME ZONE ${tz}, 'YYYY-MM') AS month,
               count(*)::bigint AS n
        FROM "Certificate"
        WHERE "tenantId" = ${tenantId} AND "issuedAt" >= ${from}
        GROUP BY 1`,
      prisma.$queryRaw<Array<{ currency: string }>>`
        SELECT c."currency" FROM "Enrollment" e JOIN "Course" c ON c."id" = e."courseId"
        WHERE c."tenantId" = ${tenantId} AND c."deletedAt" IS NULL AND e."enrolledAt" >= ${from} AND c."priceAmount" > 0
        LIMIT 1`,
      prisma.course.count({ where: { tenantId } }),
    ]);

    // Columnas timestamptz: "col AT TIME ZONE tz" da la hora de reloj en la academia
    const byMonth = <T extends { month: string }>(rows: T[]) => new Map(rows.map((r) => [r.month, r]));
    const enrollmentsByMonth = byMonth(enrollmentRows);
    const certificatesByMonth = byMonth(certificateRows);

    const newStudents: MonthlyPoint[] = months.map((m) => ({
      label: m.label,
      fullLabel: m.fullLabel,
      value: Number(enrollmentsByMonth.get(m.key)?.n ?? 0),
    }));

    const completions: MonthlyPoint[] = months.map((m) => ({
      label: m.label,
      fullLabel: m.fullLabel,
      value: Number(certificatesByMonth.get(m.key)?.n ?? 0),
    }));

    const revenue: MonthlyPoint[] = months.map((m) => ({
      label: m.label,
      fullLabel: m.fullLabel,
      value: Math.round(Number(enrollmentsByMonth.get(m.key)?.revenue ?? 0)),
    }));

    const currency = currencyRow[0]?.currency || "USD";

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
