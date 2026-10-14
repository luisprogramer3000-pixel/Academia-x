"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ClassPlanMaterial, ClassPlanOutput } from "@/modules/ai/class-plan.schema";
import { ClassPlanView } from "../../class-plan/ClassPlanView";
import { KIND_META, MaterialContent } from "../../class-plan/MaterialContent";
import { convertResourceToLessonAction, renameResourceAction } from "@/app/actions/resource.actions";
import { createLiveSessionAction } from "@/app/actions/live.actions";
import { DialogShell, fieldCls, labelCls } from "@/components/dashboard/DialogShell";
import { ScheduleClassDialog } from "@/components/dashboard/ScheduleClassDialog";
import { CalendarPlus, CheckCircle2, Download, GraduationCap, Loader2, Pencil, Zap } from "lucide-react";

export interface CourseOption {
  id: string;
  title: string;
  modules: Array<{ id: string; title: string }>;
}

export function ResourceDetailClient({
  resourceId,
  plan,
  material,
  liveQuestionCount,
  lessonHref,
  courses,
  isNew,
}: {
  resourceId: string;
  plan: ClassPlanOutput;
  material: ClassPlanMaterial | null;
  liveQuestionCount: number;
  lessonHref: string | null;
  courses: CourseOption[];
  isNew: boolean;
}) {
  const [dialog, setDialog] = useState<"convert" | "schedule" | "rename" | "live" | null>(null);

  const btn = "px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium flex items-center gap-2";

  const toolbar = (
    <>
      <button onClick={() => setDialog("rename")} className={btn} title="Cambiar título"><Pencil className="w-4 h-4" /></button>
      <button onClick={() => setDialog("schedule")} className={btn}><CalendarPlus className="w-4 h-4" /> Programar</button>
      {liveQuestionCount > 0 && (
        <button onClick={() => setDialog("live")} className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold flex items-center gap-2">
          <Zap className="w-4 h-4" /> Quiz en vivo
        </button>
      )}
      {lessonHref ? (
        <Link href={lessonHref} className="px-4 py-2.5 rounded-xl bg-emerald-600/20 border border-emerald-500/40 text-emerald-300 text-sm font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" /> Ver lección
        </Link>
      ) : (
        <button onClick={() => setDialog("convert")} className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center gap-2">
          <GraduationCap className="w-4 h-4" /> Convertir en lección
        </button>
      )}
    </>
  );

  const notice = isNew ? (
    <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
      ✓ Guardado en <Link href="/dashboard/resources" className="underline font-semibold">Mis recursos</Link>.
      {liveQuestionCount > 0 ? " Lánzalo como quiz en vivo, prográmalo" : " Prográmalo"} o conviértelo en una lección con actividades para tus alumnos.
    </div>
  ) : undefined;

  return (
    <>
      {material ? (
        <MaterialView material={{ ...material, title: plan.title }} toolbar={toolbar} notice={notice} />
      ) : (
        <ClassPlanView plan={plan} toolbar={toolbar} notice={notice} />
      )}

      {dialog === "schedule" && (
        <ScheduleClassDialog
          onClose={() => setDialog(null)}
          defaultTitle={plan.title}
          defaultDuration={plan.durationMinutes || 50}
          resourceId={resourceId}
        />
      )}
      {dialog === "live" && <LiveDialog resourceId={resourceId} questionCount={liveQuestionCount} onClose={() => setDialog(null)} />}
      {dialog === "convert" && <ConvertDialog resourceId={resourceId} courses={courses} onClose={() => setDialog(null)} />}
      {dialog === "rename" && <RenameDialog resourceId={resourceId} current={plan.title} onClose={() => setDialog(null)} />}
    </>
  );
}

function MaterialView({ material, toolbar, notice }: { material: ClassPlanMaterial; toolbar: React.ReactNode; notice?: React.ReactNode }) {
  const meta = KIND_META[material.kind];
  return (
    <div className="pb-16">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 print:hidden">
        <div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${meta.chip}`}>{meta.emoji} {meta.label}</span>
          <h1 className="text-3xl font-extrabold text-white mt-2">{material.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {toolbar}
          <button onClick={() => window.print()} className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold flex items-center gap-2">
            <Download className="w-4 h-4" /> Descargar PDF
          </button>
        </div>
      </div>
      {notice && <div className="max-w-4xl mx-auto mb-4 print:hidden">{notice}</div>}
      <div id="material-print" className="max-w-4xl mx-auto bg-white text-slate-800 rounded-2xl border border-slate-200 shadow-xl p-8 md:p-12">
        <h1 className="text-3xl font-black text-slate-900 mb-1">{material.title}</h1>
        {material.description && <p className="text-slate-500 mb-8">{material.description}</p>}
        <InteractiveOrPrint material={material} />
      </div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #material-print, #material-print * { visibility: visible; }
          #material-print { position: absolute; left: 0; top: 0; width: 100%; max-width: none; border: none; box-shadow: none; padding: 0; }
          @page { size: A4; margin: 14mm; }
        }
      `}</style>
    </div>
  );
}

/** En pantalla, interactivo; al imprimir, con la clave de respuestas desplegada. */
function InteractiveOrPrint({ material }: { material: ClassPlanMaterial }) {
  return (
    <>
      <div className="print:hidden"><MaterialContent material={material} /></div>
      <div className="hidden print:block"><MaterialContent material={material} printMode /></div>
    </>
  );
}

function LiveDialog({ resourceId, questionCount, onClose }: { resourceId: string; questionCount: number; onClose: () => void }) {
  const router = useRouter();
  const [seconds, setSeconds] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const res = await createLiveSessionAction(resourceId, seconds);
    if (!res.success) {
      setBusy(false);
      return setError(res.error);
    }
    router.push(`/dashboard/live/${res.id}`);
  }

  return (
    <DialogShell title="Quiz en vivo" onClose={onClose}>
      <p className="text-sm text-slate-300 mb-5">
        Proyecta tu pantalla: los alumnos entran desde el móvil en <strong>/live</strong> con un código, sin necesidad de cuenta.
        Se usarán <strong>{Math.min(questionCount, 30)}</strong> preguntas de opción múltiple.
      </p>
      <label className={labelCls}>Tiempo por pregunta</label>
      <div className="flex gap-2 mb-5">
        {[10, 20, 30, 60].map((s) => (
          <button key={s} type="button" onClick={() => setSeconds(s)} className={`px-4 py-2 rounded-full text-sm border ${seconds === s ? "bg-amber-500/20 border-amber-400 text-amber-200" : "border-slate-700 text-slate-300"}`}>
            {s} s
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm">Cancelar</button>
        <button onClick={start} disabled={busy} className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold flex items-center gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />} Abrir sala
        </button>
      </div>
    </DialogShell>
  );
}

function ConvertDialog({ resourceId, courses, onClose }: { resourceId: string; courses: CourseOption[]; onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"standalone" | "module">("standalone");
  const [courseId, setCourseId] = useState(courses[0]?.id ?? "");
  const course = courses.find((c) => c.id === courseId);
  const [moduleId, setModuleId] = useState(course?.modules[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    const res = await convertResourceToLessonAction(resourceId, mode === "module" ? { mode, moduleId } : { mode });
    setBusy(false);
    if (!res.success) {
      setError(res.error);
      return;
    }
    // Lección suelta: se queda en "Lecciones". Añadida a un curso: se abre en su editor del curso.
    router.push(mode === "standalone" ? `/dashboard/lessons/${res.lessonId}?nueva=1` : `/dashboard/courses/${res.courseId}/lessons/${res.lessonId}`);
  }

  const option = (value: "standalone" | "module", title: string, desc: string, disabled = false) => (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setMode(value)}
      className={`w-full text-left p-4 rounded-xl border transition-colors disabled:opacity-40 ${
        mode === value ? "border-emerald-500 bg-emerald-500/10" : "border-slate-700 hover:border-slate-500"
      }`}
    >
      <p className="font-semibold text-sm">{title}</p>
      <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
    </button>
  );

  return (
    <DialogShell title="Convertir en lección" onClose={onClose}>
      <p className="text-sm text-slate-400 mb-4">
        Los alumnos verán el contenido y las actividades intercaladas con corrección al instante. Tu guion de clase queda en el panel docente de la lección, oculto para ellos.
      </p>
      <div className="space-y-2 mb-4">
        {option("standalone", "Lección suelta", "Se crea en «Lecciones» como recurso independiente.")}
        {option("module", "Añadir a un curso", courses.length ? "Los alumnos inscritos en el curso podrán hacerla." : "Aún no tienes cursos.", courses.length === 0)}
      </div>

      {mode === "module" && course && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className={labelCls}>Curso</label>
            <select value={courseId} onChange={(e) => {
              setCourseId(e.target.value);
              setModuleId(courses.find((c) => c.id === e.target.value)?.modules[0]?.id ?? "");
            }} className={fieldCls}>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Módulo</label>
            <select value={moduleId} onChange={(e) => setModuleId(e.target.value)} className={fieldCls}>
              {course.modules.length === 0 && <option value="">Sin módulos</option>}
              {course.modules.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-400 mb-3">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm">Cancelar</button>
        <button
          onClick={submit}
          disabled={busy || (mode === "module" && !moduleId)}
          className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold flex items-center gap-2"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Crear lección
        </button>
      </div>
    </DialogShell>
  );
}

function RenameDialog({ resourceId, current, onClose }: { resourceId: string; current: string; onClose: () => void }) {
  const router = useRouter();
  const [title, setTitle] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await renameResourceAction(resourceId, title);
    setBusy(false);
    if (!res.success) return setError(res.error);
    router.refresh();
    onClose();
  }

  return (
    <DialogShell title="Cambiar título" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={fieldCls} autoFocus maxLength={200} />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm">Cancelar</button>
          <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold">Guardar</button>
        </div>
      </form>
    </DialogShell>
  );
}
