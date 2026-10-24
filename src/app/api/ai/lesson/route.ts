import { NextRequest, NextResponse } from "next/server";
import { createLessonWithAIAction } from "@/app/actions/ai.actions";

export const dynamic = "force-dynamic";

/** Lanza "Nueva lección con IA" en segundo plano (ver /api/ai/class-plan). */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Solicitud no válida." }, { status: 400 });
  }
  return NextResponse.json(await createLessonWithAIAction(form));
}
