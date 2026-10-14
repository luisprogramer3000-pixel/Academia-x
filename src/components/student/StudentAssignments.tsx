"use client";

import { useEffect, useState } from "react";
import { ClipboardList, Paperclip, CheckCircle2, AlertCircle, UploadCloud, Clock, CalendarClock } from "lucide-react";
import { getMyAssignmentsAction, submitAssignmentAction } from "@/app/actions/assignment.actions";
import { uploadMaterialFile } from "@/lib/upload-material";

interface MySubmission {
  id: string;
  content: string;
  fileUrl: string | null;
  grade: string | null;
  feedback: string | null;
  date: string;
}

interface StudentAssignment {
  id: string;
  title: string;
  description: string;
  dueDate: string | null;
  mySubmission: MySubmission | null;
}

export function StudentAssignments({ lessonId }: { lessonId: string }) {
  const [assignments, setAssignments] = useState<StudentAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<Record<string, { url: string; name: string }>>({});
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function load() {
    const res = await getMyAssignmentsAction(lessonId);
    setLoading(false);
    if (res.success) setAssignments((res.assignments as StudentAssignment[]) || []);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  async function handleUpload(assignmentId: string, file: File) {
    setBusyId(assignmentId);
    setMessage(null);
    const res = await uploadMaterialFile(file);
    setBusyId(null);
    if (res.success) {
      setUploadedFile((prev) => ({ ...prev, [assignmentId]: { url: res.fileUrl, name: res.fileName } }));
    } else {
      setMessage({ type: "error", text: res.error });
    }
  }

  async function submit(assignmentId: string, formData: FormData) {
    setBusyId(assignmentId);
    setMessage(null);

    const uploaded = uploadedFile[assignmentId];
    if (uploaded) formData.set("fileUrl", uploaded.url);

    const res = await submitAssignmentAction(assignmentId, formData);
    setBusyId(null);

    if (res.success) {
      setUploadedFile((prev) => {
        const next = { ...prev };
        delete next[assignmentId];
        return next;
      });
      setMessage({ type: "success", text: "Tarea entregada. Tu profesor la corregirá." });
      load();
    } else {
      setMessage({ type: "error", text: res.error || "No se pudo entregar." });
    }
  }

  if (loading || assignments.length === 0) return null;

  return (
    <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg space-y-4">
      <h3 className="font-bold text-white flex items-center gap-2">
        <ClipboardList className="w-5 h-5 text-cyan-400" /> Tareas de esta lección
      </h3>

      {message && (
        <div
          className={`p-3 rounded-xl text-sm flex items-start gap-2 ${
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

      {assignments.map((a) => {
        const submitted = a.mySubmission;
        const corrected = submitted && (submitted.grade || submitted.feedback);

        return (
          <div key={a.id} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            <div>
              <h4 className="text-sm font-bold text-white">{a.title}</h4>
              {a.dueDate && (() => {
                const due = new Date(a.dueDate!);
                const expired = due < new Date();
                const daysLeft = Math.ceil((due.getTime() - Date.now()) / 86400000);
                return (
                  <p className={`text-[11px] mt-1 flex items-center gap-1 ${expired ? "text-red-400" : daysLeft <= 2 ? "text-amber-400" : "text-slate-400"}`}>
                    <CalendarClock className="w-3 h-3" />
                    {expired
                      ? `Plazo vencido el ${due.toLocaleDateString("es")}`
                      : `Entrega hasta el ${due.toLocaleDateString("es")}${daysLeft <= 2 ? ` · quedan ${daysLeft} día(s)` : ""}`}
                  </p>
                );
              })()}
              <p className="text-xs text-slate-400 mt-1 whitespace-pre-line">{a.description}</p>
            </div>

            {corrected && (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-emerald-300">Corregida por tu profesor</span>
                  {submitted!.grade && (
                    <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-sm font-bold">
                      {submitted!.grade}
                    </span>
                  )}
                </div>
                {submitted!.feedback && (
                  <p className="text-xs text-emerald-100/90 whitespace-pre-line">{submitted!.feedback}</p>
                )}
              </div>
            )}

            {submitted && !corrected && (
              <p className="text-xs text-amber-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Entregada el {new Date(submitted.date).toLocaleDateString("es")} · pendiente de corrección
              </p>
            )}

            <form action={(fd) => submit(a.id, fd)} className="space-y-2">
              <textarea
                name="content"
                rows={3}
                maxLength={10000}
                defaultValue=""
                placeholder={submitted ? "Escribe una nueva versión de tu entrega..." : "Escribe aquí tu respuesta..."}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-cyan-500"
              />

              <div className="flex flex-wrap items-center gap-2">
                <label className="cursor-pointer px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium flex items-center gap-1.5 border border-slate-700">
                  <UploadCloud className="w-3.5 h-3.5" />
                  {uploadedFile[a.id] ? "Cambiar archivo" : "Adjuntar archivo"}
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(a.id, file);
                    }}
                  />
                </label>

                {uploadedFile[a.id] && (
                  <span className="text-xs text-cyan-400 flex items-center gap-1.5">
                    <Paperclip className="w-3.5 h-3.5" /> {uploadedFile[a.id].name}
                  </span>
                )}

                <button
                  type="submit"
                  disabled={busyId === a.id}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold ml-auto"
                >
                  {busyId === a.id ? "Enviando..." : submitted ? "Volver a entregar" : "Entregar"}
                </button>
              </div>
            </form>
          </div>
        );
      })}
    </div>
  );
}
