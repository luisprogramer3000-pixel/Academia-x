import { NextRequest, NextResponse } from "next/server";
import { generateClassPlanAction } from "@/app/actions/ai.actions";

export const dynamic = "force-dynamic";

/**
 * Lanza el plan de clase con IA en segundo plano y responde con el id del trabajo.
 * Es una ruta y no una acción del servidor: si el proxy del hosting devuelve algo
 * inesperado, el navegador lo trata como un error del formulario y no rompe la página.
 */
export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Solicitud no válida." }, { status: 400 });
  }
  return NextResponse.json(await generateClassPlanAction(form));
}
