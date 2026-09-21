import { AICreditType } from "@prisma/client";

export interface TopUpPackage {
  id: string;
  name: string;
  creditType: AICreditType;
  credits: number;
  price: number;
  currency: string;
  description: string;
  popular?: boolean;
}

export const TOPUP_PACKAGES: Record<string, TopUpPackage> = {
  TEACHER_TOPUP_50: {
    id: "TEACHER_TOPUP_50",
    name: "Pack Inicial Profesor",
    creditType: AICreditType.TEACHER,
    credits: 50,
    price: 15,
    currency: "USD",
    description: "50 Créditos de Profesor. Ideal para generar hasta 10 cursos completos.",
  },
  TEACHER_TOPUP_150: {
    id: "TEACHER_TOPUP_150",
    name: "Pack Pro Profesor",
    creditType: AICreditType.TEACHER,
    credits: 150,
    price: 39,
    currency: "USD",
    description: "150 Créditos de Profesor. El más popular para creación intensiva.",
    popular: true,
  },
  TEACHER_TOPUP_500: {
    id: "TEACHER_TOPUP_500",
    name: "Pack Institucional Profesor",
    creditType: AICreditType.TEACHER,
    credits: 500,
    price: 119,
    currency: "USD",
    description: "500 Créditos de Profesor. Volumen alto para grandes academias.",
  },
  STUDENT_TOPUP_100: {
    id: "STUDENT_TOPUP_100",
    name: "Pack Estudiante Básico",
    creditType: AICreditType.STUDENT,
    credits: 100,
    price: 10,
    currency: "USD",
    description: "100 Créditos de Estudiante para consultas al Tutor IA y Feedback.",
  },
  STUDENT_TOPUP_500: {
    id: "STUDENT_TOPUP_500",
    name: "Pack Estudiante Pro",
    creditType: AICreditType.STUDENT,
    credits: 500,
    price: 45,
    currency: "USD",
    description: "500 Créditos de Estudiante para academias con uso extensivo.",
    popular: true,
  },
};

export function getTopUpPackage(packageId: string): TopUpPackage | undefined {
  return TOPUP_PACKAGES[packageId];
}
