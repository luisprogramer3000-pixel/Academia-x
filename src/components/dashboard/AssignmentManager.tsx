"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Plus, Trash2, AlertCircle, CheckCircle2, Paperclip, X, CalendarClock } from "lucide-react";
import {
  createAssignmentAction,
  deleteAssignmentAction,
  getLessonAssignmentsAction,
  gradeSubmissionAction,
} from "@/app/actions/assignment.actions";

interface Submission {
  id: string;
  studentName: string;
  content: string;
  fileUrl: string | null;
  grade: string | null;
  feedback: string | null;
  date: string;
}

interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  submissions: Submission[];
}

export function AssignmentManager({ lessonId }: { lessonId: string }) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [grading, setGrading] = useState<Submission | null>(null);

  async function load() {
    const res = await getLessonAssignmentsAction(lessonId);
    setLoading(false);
    if (res.success) setAssignments((res.assignments as Assignment[]) || []);
    else setMessage({ type: "error", text: res.error || "No se pudieron cargar las tareas." });
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  async function create(formData: FormData) {
    setBusy(true);
    setMessage(null);
    const res = await createAssignmentAction(lessonId, formData);
    setBusy(false);
    if (res.success) {
      setCreating(false);
      setMessage({ type: "success", text: "Tarea creada. Tus alumnos ya la ven en la lección." });
      load();
    } else {
      setMessage({ type: "error", text: res.error || "No se pudo crear." });
    }
  }

  async function remove(id: string) {
    setBusy(true);
    const res = await deleteAssignmentAction(id);
    setBusy(false);
    if (res.success) load();
    else setMessage({ type: "error", text: res.error || "No se pudo eliminar." });
  }

  async function grade(formData: FormData) {
    if (!grading) return;
    setBusy(true);
    const res = await gradeSubmissionAction(grading.id, formData);
    setBusy(false);
    if (res.success) {
      setGrading(null);
      setMessage({ type: "success", text: "Corrección guardada. El alumno ya la ve." });
      load();
    } else {
      setMessage({ type: "error", text: res.error || "No se pudo guardar." });
    }
  }

  const pendingCount = assignments.reduce(
    (n, a) => n + a.submissions.filter((s) => !s.grade && !s.feedback).length,
    0
  );

  return (
    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-bold text-white text-base flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-cyan-400" /> Tareas de la lección
          {pendingCount > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 text-[11px] font-bold border border-amber-500/25">
              {pendingCount} sin corregir
            </span>
          )}
        </h3>
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Nueva tarea
          </button>
        )}
      </div>
      <p className="text-xs text-slate-400 mb-4">
        El alumno las ve al abrir la lección y entrega desde ahí, con texto o archivo.
      </p>

      {message && (
        <div
          className={`mb-4 p-3 rounded-xl text-sm flex items-start gap-2 ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      {creating && (
        <form action={create} className="mb-4 p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
          <input
            type="text"
            name="title"
            required
            minLength={3}
            maxLength={150}
            placeholder="Título de la tarea"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-cyan-500"
          />
          <div>
            <label className="block text-[11px] text-slate-400 mb-1.5">Fecha de entrega (opcional)</label>
            <input
              type="date"
              name="dueDate"
              min={new Date().toISOString().slice(0, 10)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
          <textarea
            name="description"
            required
            minLength={5}
            maxLength={5000}
            rows={3}
            placeholder="¿Qué tiene que hacer el alumno? Sé concreto: qué entregar y cómo se evalúa."
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-cyan-500"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-bold"
            >
              {busy ? "Creando..." : "Crear tarea"}
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white text-sm"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-xs text-slate-500">Cargando...</p>
      ) : assignments.length === 0 ? (
        <p className="text-xs text-slate-500 italic">Esta lección todavía no tiene tareas.</p>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <div key={a.id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-white">{a.title}</h4>
                  {a.dueDate && (
                    <p className="text-[11px] text-amber-400 mt-0.5 flex items-center gap-1">
                      <CalendarClock className="w-3 h-3" />
                      Entrega hasta el {new Date(a.dueDate).toLocaleDateString("es")}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{a.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(a.id)}
                  disabled={busy}
                  title="Eliminar tarea"
                  className="text-slate-500 hover:text-red-400 shrink-0 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {a.submissions.length === 0 ? (
                <p className="text-[11px] text-slate-500 italic">Sin entregas todavía.</p>
              ) : (
                <div className="space-y-2 mt-3">
                  <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                    {a.submissions.length} entrega(s)
                  </p>
                  {a.submissions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setGrading(s)}
                      className="w-full text-left p-3 rounded-lg bg-slate-900 border border-slate-800 hover:border-cyan-500/40 transition-colors flex items-center justify-between gap-3"
                    >
                      <span className="min-w-0">
                        <span className="text-sm text-white block truncate">{s.studentName}</span>
                        <span className="text-[11px] text-slate-500">
                          {new Date(s.date).toLocaleDateString("es")}
                          {s.fileUrl && " · con archivo"}
                          {a.dueDate && new Date(s.date) > new Date(a.dueDate) && (
                            <span className="text-red-400 font-semibold"> · fuera de plazo</span>
                          )}
                        </span>
                      </span>
                      {s.grade ? (
                        <span className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20 shrink-0">
                          {s.grade}
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-400 text-[11px] font-semibold border border-amber-500/20 shrink-0">
                          Corregir
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Corrección de una entrega */}
      {grading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-slate-800">
              <h4 className="font-bold text-white">Entrega de {grading.studentName}</h4>
              <button type="button" onClick={() => setGrading(null)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                <p className="text-sm text-slate-200 whitespace-pre-line">
                  {grading.content || <span className="italic text-slate-500">Sin texto</span>}
                </p>
                {grading.fileUrl && (
                  <a
                    href={grading.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300 font-semibold"
                  >
                    <Paperclip className="w-3.5 h-3.5" /> Ver archivo entregado
                  </a>
                )}
              </div>

              <form action={grade} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Nota
                  </label>
                  <input
                    type="text"
                    name="grade"
                    defaultValue={grading.grade || ""}
                    maxLength={20}
                    placeholder="Ej: 8/10, Aprobado, B+"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                    Comentarios para el alumno
                  </label>
                  <textarea
                    name="feedback"
                    defaultValue={grading.feedback || ""}
                    rows={4}
                    maxLength={5000}
                    placeholder="Qué hizo bien y qué debe mejorar."
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="px-5 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-bold"
                  >
                    {busy ? "Guardando..." : "Guardar corrección"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGrading(null)}
                    className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white text-sm"
                  >
                    Cerrar
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
