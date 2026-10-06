"use client";

import { useState } from "react";
import { DURATIONS, METHODOLOGIES } from "@/modules/ai/class-plan.schema";
import { CLASS_LANGUAGES, OTHER_LANGUAGE } from "@/modules/ai/reading-guidance";
import { Check, ChevronDown, ListPlus, Loader2, Plus, Sparkles, Trash2, WandSparkles } from "lucide-react";

const GRADES = [
  "Primaria (6-8 años)", "Primaria (9-12 años)", "Secundaria", "Bachillerato", "Universidad", "Adultos",
  "ELE A1", "ELE A2", "ELE B1", "ELE B2", "ELE C1", "ELE C2",
];
const SUBJECTS = [
  "Español", "Español como lengua extranjera (ELE)", "Inglés", "Lengua y Literatura", "Matemáticas",
  "Ciencias Naturales", "Historia", "Geografía", "Física", "Química", "Biología", "Arte", "Tecnología",
];

type Competency = { code: string; description: string };

const EXAMPLE = {
  grade: "ELE B1",
  subject: "Español como lengua extranjera (ELE)",
  topic: "Pretérito perfecto vs. pretérito indefinido",
  competencies: [
    { code: "CE.1", description: "Narrar experiencias pasadas diferenciando acciones conectadas con el presente de acciones terminadas." },
  ],
  duration: 50,
  methodology: "comunicativo",
  context: "Quiero una clase con situaciones del día a día (fin de semana, viajes) y mucha práctica oral.",
};

export function ClassPlanForm({
  pending,
  error,
  onSubmit,
  heading = "Plan de clase",
  description = "Crea un plan de clase completo por momentos, con 5 materiales listos para usar.",
  submitLabel = "Crear",
  hideHeader = false,
}: {
  pending: boolean;
  error: string | null;
  onSubmit: (fd: FormData) => void;
  heading?: string;
  description?: string;
  submitLabel?: string;
  hideHeader?: boolean;
}) {
  const [grade, setGrade] = useState("Universidad");
  const [subject, setSubject] = useState("Español");
  const [topic, setTopic] = useState("");
  const [competencies, setCompetencies] = useState<Competency[]>([{ code: "", description: "" }]);
  const [duration, setDuration] = useState(50);
  const [customDuration, setCustomDuration] = useState(false);
  const [methodology, setMethodology] = useState(METHODOLOGIES[0].id);
  const [methodOpen, setMethodOpen] = useState(false);
  const [language, setLanguage] = useState("Español");
  const [context, setContext] = useState("");
  const [imageCount, setImageCount] = useState(0);
  // Clase bilingüe: se activa sola en A1 mientras el profesor no la cambie a mano
  const [bilingual, setBilingual] = useState(false);
  const [bilingualTouched, setBilingualTouched] = useState(false);
  const [nativeLanguage, setNativeLanguage] = useState("English");
  // El idioma nativo nunca coincide con el de la clase (clase de inglés → alumnos hispanohablantes, etc.)
  const chooseLanguage = (l: string) => {
    setLanguage(l);
    if (l === nativeLanguage) setNativeLanguage(l === "Español" ? "English" : "Español");
  };
  // Recomendado en A1 y en primaria: se enciende solo al elegir esos niveles
  const isA1 = /\bA1\b/i.test(grade) || /primaria/i.test(grade);
  const bilingualOn = bilingualTouched ? bilingual : isA1;

  const method = METHODOLOGIES.find((m) => m.id === methodology) ?? METHODOLOGIES[0];

  function fillExample() {
    setGrade(EXAMPLE.grade);
    setSubject(EXAMPLE.subject);
    setTopic(EXAMPLE.topic);
    setCompetencies(EXAMPLE.competencies);
    setDuration(EXAMPLE.duration);
    setCustomDuration(false);
    setMethodology(EXAMPLE.methodology);
    setContext(EXAMPLE.context);
  }

  function updateCompetency(i: number, field: keyof Competency, value: string) {
    setCompetencies((prev) => prev.map((c, ci) => (ci === i ? { ...c, [field]: value } : c)));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("methodology", `${method.label}: ${method.description}`);
    fd.set("methodologyId", method.id);
    fd.set("durationMinutes", String(duration));
    fd.set("idempotencyKey", crypto.randomUUID());
    onSubmit(fd);
  }

  const inputCls =
    "w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors";
  const labelCls = "block text-sm font-semibold text-slate-200 mb-2";

  return (
    <form onSubmit={handleSubmit} className="pb-28">
      <div className={`flex items-start gap-4 mb-8 ${hideHeader ? "justify-end" : "justify-between"}`}>
        {!hideHeader && (
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-white">{heading}</h1>
              <p className="text-slate-400 text-sm mt-1">{description}</p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={fillExample}
          className="shrink-0 px-3 py-2 rounded-lg text-sm font-semibold text-slate-200 hover:bg-slate-800 flex items-center gap-2 transition-colors"
        >
          <ListPlus className="w-4 h-4" /> Rellenar ejemplo
        </button>
      </div>

      <div className="space-y-6">
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label className={labelCls}>Grado</label>
            <select name="grade" value={grade} onChange={(e) => setGrade(e.target.value)} className={inputCls}>
              {GRADES.map((g) => <option key={g}>{g}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Asignatura</label>
            <input
              name="subject"
              list="class-plan-subjects"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              className={inputCls}
            />
            <datalist id="class-plan-subjects">
              {SUBJECTS.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
        </div>

        <div>
          <label className={labelCls}>Tema</label>
          <input
            name="topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            required
            minLength={3}
            placeholder="Escribe el tema de la clase. Ej. Pretérito perfecto"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>
            Competencias y aprendizajes <span className="text-slate-500 font-normal">(opcional)</span>
          </label>
          <div className="space-y-2">
            {competencies.map((c, i) => (
              <div key={i} className="flex gap-2">
                <input
                  name="competencyCode"
                  value={c.code}
                  onChange={(e) => updateCompetency(i, "code", e.target.value)}
                  placeholder="Código"
                  className={`${inputCls} max-w-[160px]`}
                />
                <input
                  name="competencyDescription"
                  value={c.description}
                  onChange={(e) => updateCompetency(i, "description", e.target.value)}
                  placeholder="Describe la habilidad…"
                  className={inputCls}
                />
                <button
                  type="button"
                  onClick={() => setCompetencies((prev) => (prev.length > 1 ? prev.filter((_, ci) => ci !== i) : [{ code: "", description: "" }]))}
                  className="px-3 rounded-xl text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                  title="Quitar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          {competencies.length < 8 && (
            <button
              type="button"
              onClick={() => setCompetencies((prev) => [...prev, { code: "", description: "" }])}
              className="mt-2 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Añadir otra habilidad
            </button>
          )}
        </div>

        <div>
          <label className={labelCls}>Tiempo de clase</label>
          <div className="flex flex-wrap gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => { setDuration(d); setCustomDuration(false); }}
                className={`px-5 py-2 rounded-full text-sm border transition-colors ${
                  !customDuration && duration === d
                    ? "bg-blue-600/20 border-blue-500 text-blue-200"
                    : "border-slate-700 text-slate-300 hover:border-slate-500"
                }`}
              >
                {d} minutos
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCustomDuration(true)}
              className={`px-5 py-2 rounded-full text-sm border transition-colors ${
                customDuration ? "bg-blue-600/20 border-blue-500 text-blue-200" : "border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              Otro
            </button>
            {customDuration && (
              <input
                type="number"
                min={15}
                max={240}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) || 15)}
                className="w-28 px-3 py-2 rounded-full bg-slate-900 border border-slate-700 text-white text-sm"
              />
            )}
          </div>
        </div>

        <div className="relative">
          <label className={labelCls}>Estilo de clase / Metodología</label>
          <button
            type="button"
            onClick={() => setMethodOpen((v) => !v)}
            className={`${inputCls} text-left flex items-center justify-between gap-3`}
          >
            <span>
              <span className="block font-semibold">{method.label}</span>
              <span className="block text-slate-400 text-xs mt-0.5">{method.description}</span>
            </span>
            <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${methodOpen ? "rotate-180" : ""}`} />
          </button>
          {methodOpen && (
            <div className="absolute z-20 mt-2 w-full max-h-80 overflow-y-auto rounded-xl bg-slate-900 border border-slate-700 shadow-2xl">
              {METHODOLOGIES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setMethodology(m.id); setMethodOpen(false); }}
                  className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-800 transition-colors ${m.id === methodology ? "bg-blue-600/10" : ""}`}
                >
                  <span className="w-4 pt-0.5">{m.id === methodology && <Check className="w-4 h-4 text-blue-400" />}</span>
                  <span>
                    <span className="block text-sm font-semibold text-white">{m.label}</span>
                    <span className="block text-xs text-slate-400 mt-0.5">{m.description}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className={labelCls}>
            Imágenes ilustrativas <span className="text-slate-500 font-normal">(1 crédito cada una)</span>
          </label>
          <input type="hidden" name="imageCount" value={imageCount} />
          <div className="flex flex-wrap gap-2">
            {[0, 2, 4].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setImageCount(n)}
                className={`px-5 py-2 rounded-full text-sm border transition-colors ${
                  imageCount === n ? "bg-blue-600/20 border-blue-500 text-blue-200" : "border-slate-700 text-slate-300 hover:border-slate-500"
                }`}
              >
                {n === 0 ? "Sin imágenes" : `${n} imágenes`}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1.5">La IA ilustra el reto, la lectura y los conceptos que más lo necesitan.</p>
        </div>

        <div>
          <label className={labelCls}>
            Idioma de la clase <span className="text-slate-500 font-normal">(opcional)</span>
          </label>
          <LanguagePicker name="language" value={language} onChange={chooseLanguage} className={inputCls} />
        </div>

        <div className={`rounded-2xl border p-4 transition-colors ${bilingualOn ? "border-emerald-500/50 bg-emerald-500/5" : "border-slate-700"}`}>
          <input type="hidden" name="bilingual" value={bilingualOn ? "1" : "0"} />
          <input type="hidden" name="nativeLanguage" value={nativeLanguage} />
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                🌐 Clase bilingüe
                {isA1 && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">Recomendado en este nivel</span>}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Explicaciones con su traducción, vocabulario con columna de traducción y consignas en los dos idiomas.
                La lectura y las respuestas se mantienen en el idioma que se aprende.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={bilingualOn}
              aria-label="Clase bilingüe"
              onClick={() => { setBilingualTouched(true); setBilingual(!bilingualOn); }}
              className={`relative shrink-0 w-12 h-7 rounded-full transition-colors ${bilingualOn ? "bg-emerald-500" : "bg-slate-700"}`}
            >
              <span className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all ${bilingualOn ? "left-6" : "left-1"}`} />
            </button>
          </div>
          {bilingualOn && (
            <div className="mt-3 flex items-center gap-3">
              <label className="text-xs text-slate-300 shrink-0">Idioma nativo de los alumnos</label>
              <LanguagePicker value={nativeLanguage} onChange={setNativeLanguage} className={`${inputCls} py-2`} exclude={language} />
            </div>
          )}
          {bilingualOn && !isA1 && /\b(B1|B2|C1|C2)\b/i.test(grade) && (
            <p className="text-xs text-amber-300/90 mt-2">A partir de B1 se recomienda la clase íntegramente en el idioma que se aprende.</p>
          )}
        </div>

        <div>
          <label className={labelCls}>
            Contexto de la clase <span className="text-slate-500 font-normal">(opcional)</span>
          </label>
          <textarea
            name="context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Ejemplo: Quiero una clase con aplicaciones del tema en el día a día y cómo se relaciona con…"
            className={`${inputCls} resize-none`}
          />
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
        )}
      </div>

      <div className="fixed bottom-0 left-64 right-0 z-30 p-4 bg-slate-950/90 backdrop-blur border-t border-slate-800">
        <button
          type="submit"
          disabled={pending}
          className="w-full max-w-3xl mx-auto py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg shadow-blue-600/20"
        >
          {pending ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Preparando tu clase… (1–3 min{imageCount ? ", con imágenes algo más" : ""})</>
          ) : (
            <><WandSparkles className="w-4 h-4" /> {submitLabel}</>
          )}
        </button>
      </div>
    </form>
  );
}

/** Selector de idioma con la lista común y la opción "Otro…" para escribir cualquier idioma. */
function LanguagePicker({ value, onChange, className, name, exclude }: { value: string; onChange: (v: string) => void; className: string; name?: string; exclude?: string }) {
  const custom = !CLASS_LANGUAGES.includes(value);
  return (
    <div className="flex-1 flex flex-col gap-2">
      {name && <input type="hidden" name={name} value={value} />}
      <select value={custom ? OTHER_LANGUAGE : value} onChange={(e) => onChange(e.target.value === OTHER_LANGUAGE ? "" : e.target.value)} className={className}>
        {CLASS_LANGUAGES.filter((l) => l !== exclude).map((l) => <option key={l}>{l}</option>)}
        <option>{OTHER_LANGUAGE}</option>
      </select>
      {custom && (
        <input value={value} onChange={(e) => onChange(e.target.value)} maxLength={40} placeholder="Escribe el idioma (p. ej. Quechua, Catalán…)" className={className} autoFocus />
      )}
    </div>
  );
}
