"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, Trash2, Archive, AlertCircle, CheckCircle2, X } from "lucide-react";
import { updateCourseAction, deleteCourseAction, archiveCourseAction } from "@/app/actions/course.actions";

interface CourseSettingsFormProps {
  courseId: string;
  initial: {
    title: string;
    description: string | null;
    level: string;
    language: string;
    priceAmount: number;
    currency: string;
    paymentType: string;
    paymentLink: string | null;
    paymentInstructions: string | null;
    freePreview: boolean;
  };
}

const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2", "Todos los niveles"];

export function CourseSettingsForm({ courseId, initial }: CourseSettingsFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [paymentType, setPaymentType] = useState(initial.paymentType);
  const [price, setPrice] = useState(String(initial.priceAmount));

  const isPaid = Number(price) > 0;

  async function handleSave(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const res = await updateCourseAction(courseId, formData);
    setSaving(false);
    if (res.success) {
      setMessage({ type: "success", text: "Cambios guardados." });
      router.refresh();
    } else {
      setMessage({ type: "error", text: res.error || "No se pudo guardar." });
    }
  }

  async function handleDelete() {
    setSaving(true);
    setMessage(null);
    const res = await deleteCourseAction(courseId);
    setSaving(false);
    if (res.success) {
      router.push("/dashboard/courses");
    } else {
      setConfirmDelete(false);
      setMessage({ type: "error", text: res.error || "No se pudo eliminar." });
    }
  }

  async function handleArchive() {
    setSaving(true);
    setMessage(null);
    const res = await archiveCourseAction(courseId);
    setSaving(false);
    if (res.success) {
      router.push("/dashboard/courses");
    } else {
      setMessage({ type: "error", text: res.error || "No se pudo archivar." });
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-5 py-2.5 rounded-xl font-semibold text-sm transition-all shadow-lg flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700"
      >
        <Settings className="w-4 h-4" /> Editar curso
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/80 backdrop-blur-sm overflow-y-auto p-4">
      <div className="w-full max-w-2xl my-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-400" /> Ajustes del curso
          </h3>
          <button type="button" onClick={() => setOpen(false)} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {message && (
          <div
            className={`mx-6 mt-6 p-3 rounded-xl text-sm flex items-center gap-2 ${
              message.type === "success"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-red-500/10 text-red-400 border border-red-500/20"
            }`}
          >
            {message.type === "success" ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        <form action={handleSave} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Título</label>
            <input
              type="text"
              name="title"
              defaultValue={initial.title}
              required
              minLength={3}
              maxLength={150}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Descripción</label>
            <textarea
              name="description"
              defaultValue={initial.description || ""}
              rows={3}
              maxLength={5000}
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Nivel</label>
              <select
                name="level"
                defaultValue={initial.level}
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Precio ({initial.currency})
              </label>
              <input
                type="number"
                name="priceAmount"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                min={0}
                step="0.01"
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
              />
              <p className="text-xs text-slate-500 mt-1">0 = curso gratuito, con inscripción directa del alumno.</p>
            </div>
          </div>

          <input type="hidden" name="language" value={initial.language} />

          <label className="flex items-start gap-3 p-4 rounded-2xl bg-slate-950/60 border border-slate-800 cursor-pointer">
            <input type="checkbox" name="freePreview" defaultChecked={initial.freePreview} className="mt-1 w-4 h-4 accent-blue-500" />
            <span>
              <span className="block text-sm font-semibold text-white">Lección de muestra gratis</span>
              <span className="block text-xs text-slate-400">
                La primera lección se ve completa en la página pública del curso, para que el alumno conozca tu forma de enseñar antes de inscribirse. El resto queda bloqueado.
              </span>
            </span>
          </label>

          {isPaid && (
            <div className="space-y-4 p-4 rounded-2xl bg-slate-950/60 border border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Cobro</label>
                <select
                  name="paymentType"
                  value={paymentType}
                  onChange={(e) => setPaymentType(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="EXTERNAL">Enlace externo de pago</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Enlace de pago
                </label>
                <input
                  type="url"
                  name="paymentLink"
                  defaultValue={initial.paymentLink || ""}
                  placeholder="https://..."
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm font-mono focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Opcional: link de pago de Payphone, PayPal, Hotmart… El alumno verá el botón &quot;Pagar en línea&quot;.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Instrucciones de pago
                </label>
                <textarea
                  name="paymentInstructions"
                  defaultValue={initial.paymentInstructions || ""}
                  rows={4}
                  maxLength={2000}
                  placeholder={"Ej. Transferencia al Banco Pichincha\nCuenta de ahorros 2200000000\nA nombre de: ...\nEnvía el comprobante al solicitar la inscripción."}
                  className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-blue-500"
                />
                <p className="text-xs text-slate-500 mt-1">
                  El alumno envía una solicitud con su comprobante; tú la apruebas en <strong>Solicitudes</strong> y recibe el acceso por correo.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold transition-colors"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-5 py-3 rounded-xl text-slate-400 hover:text-white font-medium"
            >
              Cancelar
            </button>
          </div>
        </form>

        <div className="p-6 border-t border-slate-800 space-y-3">
          <h4 className="text-sm font-bold text-slate-300">Retirar el curso</h4>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={handleArchive}
              disabled={saving}
              className="flex-1 px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2 border border-slate-700"
            >
              <Archive className="w-4 h-4" /> Archivar
            </button>

            {!confirmDelete ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={saving}
                className="flex-1 px-4 py-3 rounded-xl bg-red-600/10 hover:bg-red-600/20 disabled:opacity-50 text-red-400 text-sm font-semibold flex items-center justify-center gap-2 border border-red-500/30"
              >
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            ) : (
              <div className="flex-1 flex gap-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-bold"
                >
                  Mover a la papelera
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-4 py-3 rounded-xl bg-slate-800 text-slate-300 text-sm font-semibold"
                >
                  No
                </button>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-500">
            <strong className="text-slate-400">Archivar</strong> lo retira del catálogo conservando alumnos y
            certificados. <strong className="text-slate-400">Eliminar</strong> lo mueve a la Papelera con sus módulos,
            lecciones y alumnos: puedes restaurarlo durante 30 días. No está permitido si ya emitió certificados.
          </p>
        </div>
      </div>
    </div>
  );
}
