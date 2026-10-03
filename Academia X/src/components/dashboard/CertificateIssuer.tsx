"use client";

import { useEffect, useState } from "react";
import { Award, CheckCircle2, AlertCircle, ExternalLink, Users } from "lucide-react";
import {
  getCourseStudentsForCertificationAction,
  approveCertificateAction,
  setCourseCertificateTemplateAction,
} from "@/app/actions/certificate.actions";
import { CERTIFICATE_TEMPLATE_LIST, getCertificateTemplate } from "@/modules/certificate/certificate.templates";

interface CourseOption {
  id: string;
  title: string;
}

interface StudentRow {
  userId: string;
  name: string;
  email: string;
  completedLessons: number;
  percentage: number;
  certificate: { code: string; issuedAt: string; template: string } | null;
}

export function CertificateIssuer({ courses, academyName }: { courses: CourseOption[]; academyName: string }) {
  const [courseId, setCourseId] = useState(courses[0]?.id || "");
  const [template, setTemplate] = useState("CLASSIC");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [totalLessons, setTotalLessons] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyUser, setBusyUser] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function load(id: string) {
    if (!id) return;
    setLoading(true);
    setMessage(null);
    const res = await getCourseStudentsForCertificationAction(id);
    setLoading(false);
    if (res.success) {
      setStudents((res.students as StudentRow[]) || []);
      setTotalLessons(res.totalLessons || 0);
      setTemplate(res.template || "CLASSIC");
    } else {
      setMessage({ type: "error", text: res.error || "No se pudieron cargar los alumnos." });
    }
  }

  useEffect(() => {
    load(courseId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function chooseTemplate(id: string) {
    setTemplate(id);
    const res = await setCourseCertificateTemplateAction(courseId, id);
    if (!res.success) setMessage({ type: "error", text: res.error || "No se pudo guardar la plantilla." });
  }

  async function approve(userId: string) {
    setBusyUser(userId);
    setMessage(null);
    const res = await approveCertificateAction(courseId, userId);
    setBusyUser(null);
    if (res.success) {
      setMessage({ type: "success", text: `Certificado emitido: ${res.code}` });
      load(courseId);
    } else {
      setMessage({ type: "error", text: res.error || "No se pudo emitir." });
    }
  }

  const active = getCertificateTemplate(template);

  if (courses.length === 0) {
    return (
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 text-sm text-slate-400">
        Crea un curso para poder emitir certificados.
      </div>
    );
  }

  return (
    <div className="space-y-6">
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

      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Curso</label>
        <select
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500"
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
      </div>

      {/* Elección de plantilla */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <h3 className="font-bold text-white mb-1 flex items-center gap-2">
          <Award className="w-4 h-4 text-amber-400" /> Modelo del certificado
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Se aplica a los certificados que emitas de este curso. Los ya emitidos conservan su diseño.
        </p>

        <div className="grid sm:grid-cols-3 gap-3 mb-5">
          {CERTIFICATE_TEMPLATE_LIST.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => chooseTemplate(t.id)}
              className={`text-left p-4 rounded-xl border-2 transition-all ${
                template === t.id ? "border-amber-500 bg-amber-500/5" : "border-slate-800 hover:border-slate-700"
              }`}
            >
              <div
                className="h-14 rounded-lg mb-3 flex items-center justify-center text-[10px] font-bold"
                style={{
                  backgroundColor: t.style.surface,
                  color: t.style.heading,
                  border: `2px ${t.style.frame === "double" ? "double" : "solid"} ${t.style.border}`,
                }}
              >
                <span style={{ color: t.style.accent }}>★ {t.name.toUpperCase()} ★</span>
              </div>
              <p className="text-sm font-bold text-white">{t.name}</p>
              <p className="text-[11px] text-slate-400 mt-1 leading-snug">{t.description}</p>
            </button>
          ))}
        </div>

        {/* Vista previa del elegido */}
        <div
          className="rounded-xl p-6 text-center"
          style={{
            backgroundColor: active.style.surface,
            border: `3px ${active.style.frame === "double" ? "double" : "solid"} ${active.style.border}`,
          }}
        >
          <p className="text-[10px] uppercase tracking-[0.25em] mb-2" style={{ color: active.style.accent }}>
            {academyName}
          </p>
          <p className="text-sm font-semibold mb-3" style={{ color: active.style.heading }}>
            {active.heading}
          </p>
          <p className={`text-2xl ${active.style.nameClass} font-bold mb-2`} style={{ color: active.style.heading }}>
            Nombre del Alumno
          </p>
          <p className="text-xs" style={{ color: active.style.body }}>
            {active.statement}
          </p>
          <p className="text-sm font-semibold mt-1" style={{ color: active.style.accent }}>
            {courses.find((c) => c.id === courseId)?.title}
          </p>
        </div>
      </div>

      {/* Alumnos inscritos */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <h3 className="font-bold text-white mb-1 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" /> Alumnos inscritos
        </h3>
        <p className="text-xs text-slate-400 mb-4">
          Tú apruebas quién recibe el certificado. El progreso es una guía, no una condición automática.
        </p>

        {loading ? (
          <p className="text-xs text-slate-500">Cargando...</p>
        ) : students.length === 0 ? (
          <p className="text-xs text-slate-500 italic">Nadie inscrito todavía en este curso.</p>
        ) : (
          <div className="space-y-2">
            {students.map((s) => (
              <div
                key={s.userId}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800"
              >
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{s.name}</p>
                  <p className="text-[11px] text-slate-500">
                    {s.completedLessons}/{totalLessons} lecciones · {s.percentage}% completado
                  </p>
                  <div className="w-40 h-1.5 rounded-full bg-slate-800 mt-1.5 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.percentage === 100 ? "bg-emerald-500" : "bg-blue-500"}`}
                      style={{ width: `${s.percentage}%` }}
                    />
                  </div>
                </div>

                {s.certificate ? (
                  <a
                    href={`/verify/${s.certificate.code}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 px-4 py-2 rounded-xl bg-emerald-500/10 text-emerald-400 text-xs font-bold border border-emerald-500/20 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> {s.certificate.code}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <button
                    type="button"
                    onClick={() => approve(s.userId)}
                    disabled={busyUser === s.userId}
                    className="shrink-0 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
                  >
                    <Award className="w-3.5 h-3.5" />
                    {busyUser === s.userId ? "Emitiendo..." : "Aprobar y emitir"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
