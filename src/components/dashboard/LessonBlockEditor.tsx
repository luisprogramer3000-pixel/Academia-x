"use client";

import { Fragment, useState } from "react";
import { updateLessonContentAction, updateLessonSettingsAction } from "@/app/actions/course.actions";
import {
  Type,
  Video,
  FileText,
  HelpCircle,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  MoveUp,
  MoveDown,
  Eye,
  Edit3,
  UploadCloud,
  ImageIcon,
} from "lucide-react";
import { uploadMaterialFile } from "@/lib/upload-material";
import { missingMaterial } from "@/modules/ai/exercise-integrity";
import { LessonAIPanel } from "./LessonAIPanel";
import { PresentationDownload } from "./PresentationDownload";
import { ClassAgentWizard, TeacherPlan } from "./ClassAgentWizard";
import { MindMapView } from "@/components/shared/MindMapView";
import { AssignmentManager } from "./AssignmentManager";
import { QuizResultsPanel } from "./QuizResultsPanel";
import { saveTeacherPlanAction } from "@/app/actions/course.actions";
import { LessonReader, type LessonBlock as ReaderBlock } from "@/components/lesson/LessonReader";
import { TeacherPlanPanel } from "./TeacherPlanPanel";
import { LessonImagePicker } from "./LessonImagePicker";
import { cleanTitle, stripStrayImageUrls } from "@/components/lesson/lesson-blocks";

const fieldLabel = "block text-xs font-medium text-slate-400 mb-1";

/** Botón "+" entre bloques: añade texto, imagen o ejercicio justo en ese punto. */
function InsertHere({ open, onToggle, onAdd }: { open: boolean; onToggle: () => void; onAdd: (type: LessonBlock["type"]) => void }) {
  const opts: Array<[LessonBlock["type"], string]> = [
    ["text", "📝 Texto / concepto"],
    ["image", "🖼️ Imagen"],
    ["quiz", "❓ Quiz"],
    ["practice", "✏️ Ejercicio abierto"],
    ["video", "🎬 Video"],
  ];
  return (
    <div className="flex flex-col items-center -my-2">
      <button
        type="button"
        onClick={onToggle}
        title="Añadir un bloque aquí"
        className={`px-3 py-0.5 rounded-full text-[11px] font-semibold border transition-colors ${open ? "bg-blue-600 border-blue-500 text-white" : "bg-slate-950 border-slate-800 text-slate-500 hover:text-white hover:border-slate-600"}`}
      >
        {open ? "× Cerrar" : "+ Añadir aquí"}
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap justify-center gap-2">
          {opts.map(([type, label]) => (
            <button key={type} type="button" onClick={() => onAdd(type)} className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 hover:border-blue-500 text-xs text-slate-200">
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
const fieldInput =
  "w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500";

export interface LessonBlock {
  id: string;
  type: "text" | "video" | "resource" | "quiz" | "image" | "mindmap" | "chapter" | "practice" | "flashcards" | "dialogue";
  lines?: Array<{ speaker: string; text: string; translation?: string }>;
  label?: string;
  emoji?: string;
  difficulty?: string;
  answer?: string;
  cards?: Array<{ front: string; back: string }>;
  title?: string;
  content?: string;
  url?: string;
  question?: string;
  options?: string[];
  correctOptionIndex?: number;
  explanation?: string;
  /** Solo para bloques de tipo mindmap */
  mindMap?: { center: string; branches: Array<{ label: string; children: string[] }> };
  /** Medida de la imagen de una sección de texto */
  imageSize?: "auto" | "small" | "medium" | "large" | "full";
}

const IMAGE_SIZES: Array<[NonNullable<LessonBlock["imageSize"]>, string, string]> = [
  ["auto", "Automática", "Según el espacio: poco texto → a todo el ancho; mucho texto → columna grande al lado"],
  ["small", "Pequeña", "Columna estrecha al lado del texto"],
  ["medium", "Mediana", "Columna al lado del texto"],
  ["large", "Grande", "Mitad del ancho, acompaña al texto al leer"],
  ["full", "Ancho completo", "Debajo del texto, a todo el ancho"],
];

/** Dirección de una imagen arrastrada (desde la biblioteca, otra pestaña o la propia lección). */
function droppedImageUrl(e: React.DragEvent): string | null {
  const raw = e.dataTransfer.getData("text/uri-list") || e.dataTransfer.getData("text/plain");
  const url = raw.split(/\s+/).find((x) => /^(https?:\/\/|\/api\/uploads\/)/.test(x));
  if (url && (/\/api\/uploads\//.test(url) || /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url))) return url;
  const html = e.dataTransfer.getData("text/html");
  return html.match(/<img[^>]+src="([^"]+)"/i)?.[1] ?? null;
}

interface LessonBlockEditorProps {
  lessonId: string;
  courseId: string;
  lessonTitle: string;
  initialContentJson?: string | null;
  initialLiveUrl?: string | null;
  initialTeacherPlan?: TeacherPlan | null;
  tenantSlug: string;
  /** Lección recién creada con IA: abre la vista previa y muestra un aviso */
  isNew?: boolean;
  previewHref?: string;
  accentColor?: string;
}

export function LessonBlockEditor({
  lessonId,
  courseId,
  lessonTitle,
  initialContentJson,
  initialLiveUrl,
  initialTeacherPlan,
  tenantSlug,
  isNew = false,
  previewHref,
  accentColor = "#2563eb",
}: LessonBlockEditorProps) {
  const parseInitialBlocks = (): LessonBlock[] => {
    if (!initialContentJson) return [];
    try {
      const parsed = JSON.parse(initialContentJson);
      if (Array.isArray(parsed.blocks)) return parsed.blocks;
      if (Array.isArray(parsed)) return parsed;
      return [];
    } catch {
      return [];
    }
  };

  const [blocks, setBlocks] = useState<LessonBlock[]>(parseInitialBlocks());
  const [liveUrl, setLiveUrl] = useState(initialLiveUrl || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">(isNew ? "preview" : "edit");
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(parseInitialBlocks()));
  const [teacherPlan, setTeacherPlan] = useState<TeacherPlan | null>(initialTeacherPlan ?? null);

  const addBlock = (type: LessonBlock["type"], at?: number) => {
    const newBlock: LessonBlock = {
      id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type,
      title: type === "video" ? "Video de la Lección" : type === "resource" ? "Material Descargable" : "",
      content: type === "text" ? "Escribe aquí la teoría o contenido explicativo de la lección..." : "",
      url: type === "video" ? "https://www.youtube.com/watch?v=dQw4w9WgXcQ" : "",
      question: type === "quiz" ? "¿Cuál de las siguientes frases expresa una hipótesis en el pasado?" : type === "practice" ? "Escribe aquí el enunciado del ejercicio." : "",
      options: type === "quiz" ? ["Si hubiera sabido...", "Si sé...", "Cuando supe...", "Sabiendo que..."] : [],
      correctOptionIndex: 0,
    };
    setBlocks((prev) => (at === undefined ? [...prev, newBlock] : [...prev.slice(0, at), newBlock, ...prev.slice(at)]));
    setInsertAt(null);
    // Llevar al profesor hasta el bloque nuevo
    setTimeout(() => document.getElementById(newBlock.id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const [insertAt, setInsertAt] = useState<number | null>(null);

  /** Mueve un bloque a la posición `to` (índice en la lista sin ese bloque) y lo enseña. */
  const moveBlockTo = (index: number, to: number) => {
    const updated = [...blocks];
    const [moved] = updated.splice(index, 1);
    updated.splice(Math.max(0, Math.min(updated.length, to)), 0, moved);
    setBlocks(updated);
    setTimeout(() => document.getElementById(moved.id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  // Capítulos de la lección (Reto, Teoría, Lectura, Ejercicios…) para "Mover a…"
  const chapters = blocks.map((b, i) => ({ b, i })).filter(({ b }) => b.type === "chapter");

  /** Destino al final de un capítulo (antes del siguiente), en la lista sin el bloque que se mueve. */
  const endOfChapter = (chapterIndex: number, movingIndex: number) => {
    const next = blocks.findIndex((b, i) => i > chapterIndex && b.type === "chapter");
    const end = next < 0 ? blocks.length : next;
    return movingIndex < end ? end - 1 : end;
  };

  /** La imagen suelta pasa a ser la imagen de la sección de texto de arriba. */
  const attachImageToPrevious = (index: number) => {
    const img = blocks[index];
    const prevIndex = blocks.slice(0, index).map((b) => b.type).lastIndexOf("text");
    if (prevIndex < 0 || !img.url) return;
    setBlocks((prev) => prev.filter((b) => b.id !== img.id).map((b, i) => (i === prevIndex ? { ...b, url: img.url } : b)));
    setMessage({ type: "success", text: `Imagen unida a la sección «${blocks[prevIndex].title || "de texto"}». Pulsa Guardar.` });
  };

  const moveBlock = (index: number, direction: "up" | "down") => {
    if ((direction === "up" && index === 0) || (direction === "down" && index === blocks.length - 1)) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const updated = [...blocks];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setBlocks(updated);
  };

  // Reparte las preguntas entre las secciones (tras la sección i van las que tocan hasta floor((i+1)·Q/S))
  const interleaveActivities = () => {
    const quizzes = blocks.filter((b) => b.type === "quiz");
    const others = blocks.filter((b) => b.type !== "quiz");
    if (!quizzes.length || !others.length) return;
    const out: LessonBlock[] = [];
    let placed = 0;
    others.forEach((b, i) => {
      out.push(b);
      const target = Math.floor(((i + 1) * quizzes.length) / others.length);
      while (placed < target && i > 0) out.push(quizzes[placed++]);
    });
    while (placed < quizzes.length) out.push(quizzes[placed++]);
    setBlocks(out);
    setMessage({ type: "success", text: `${quizzes.length} actividades repartidas entre las explicaciones. Revisa la vista previa y pulsa Guardar.` });
  };

  const quizCount = blocks.filter((b) => b.type === "quiz").length;
  const firstQuiz = blocks.findIndex((b) => b.type === "quiz");
  // Todas las preguntas juntas al final: sugiere intercalarlas
  const activitiesBunched = quizCount >= 2 && firstQuiz >= 0 && blocks.slice(firstQuiz).every((b) => b.type === "quiz");

  const updateBlock = (id: string, updates: Partial<LessonBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      // Limpieza: direcciones de imágenes pegadas en el texto y "###" en los subtítulos
      const clean = blocks.map((b) => (b.type === "text" ? { ...b, title: b.title ? cleanTitle(b.title) : b.title, content: b.content ? stripStrayImageUrls(b.content) : b.content } : b));
      setBlocks(clean);
      const contentJson = JSON.stringify({ blocks: clean });
      await updateLessonContentAction(lessonId, contentJson);
      
      const formData = new FormData();
      if (liveUrl) formData.set("liveUrl", liveUrl);
      await updateLessonSettingsAction(lessonId, formData);
      setSavedSnapshot(JSON.stringify(clean));

      setMessage({ type: "success", text: "¡Contenido de la lección guardado exitosamente!" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Error al guardar el contenido." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-lg">
        <div>
          <span className="text-xs font-mono text-blue-400 uppercase font-semibold block mb-1">
            Editor de Contenido por Bloques
          </span>
          <h2 className="text-xl font-bold text-white leading-tight">{lessonTitle}</h2>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === "edit" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" /> Editar
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("preview")}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === "preview" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <Eye className="w-3.5 h-3.5" /> Previsualizar
            </button>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/30 flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Guardando..." : "Guardar Lección"}
          </button>
        </div>
      </div>

      {message && (
        <div
          className={`p-4 rounded-xl text-sm font-semibold flex items-center gap-3 transition-all ${
            message.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
              : "bg-red-500/10 border border-red-500/30 text-red-400"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-400" />
          )}
          {message.text}
        </div>
      )}

      {isNew && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
          ✓ Lección creada con IA: contenido, {blocks.filter((b) => b.type === "quiz").length} actividades intercaladas y tu guion de clase.
          Revísala en la vista previa, ajusta lo que quieras en <strong>Editar</strong> y guarda. También quedó guardada en Mis recursos.
        </div>
      )}

      {teacherPlan && <TeacherPlanPanel plan={teacherPlan} />}

      {activitiesBunched && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-amber-200">
            Las {quizCount} actividades están todas al final. Intercálalas entre las explicaciones para que el alumno practique mientras aprende.
          </p>
          <button
            type="button"
            onClick={interleaveActivities}
            className="shrink-0 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
          >
            Intercalar actividades
          </button>
        </div>
      )}

      {activeTab === "edit" ? (
        <>
          {/* Barra para añadir bloques: arriba, a mano al empezar a editar */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="block text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Añadir Nuevo Bloque a la Lección:
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <button
                type="button"
                onClick={() => addBlock("text")}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500/50 transition-all text-left group"
              >
                <Type className="w-5 h-5 text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                <div className="font-semibold text-xs text-white">Texto / Teoría</div>
                <div className="text-[10px] text-slate-400">Explicaciones</div>
              </button>

              <button
                type="button"
                onClick={() => addBlock("image")}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-pink-500/50 transition-all text-left group"
              >
                <ImageIcon className="w-5 h-5 text-pink-400 mb-2 group-hover:scale-110 transition-transform" />
                <div className="font-semibold text-xs text-white">Imagen</div>
                <div className="text-[10px] text-slate-400">Subir o biblioteca</div>
              </button>

              <button
                type="button"
                onClick={() => addBlock("video")}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/50 transition-all text-left group"
              >
                <Video className="w-5 h-5 text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
                <div className="font-semibold text-xs text-white">Video</div>
                <div className="text-[10px] text-slate-400">YouTube / MP4</div>
              </button>

              <button
                type="button"
                onClick={() => addBlock("resource")}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/50 transition-all text-left group"
              >
                <FileText className="w-5 h-5 text-emerald-400 mb-2 group-hover:scale-110 transition-transform" />
                <div className="font-semibold text-xs text-white">Recurso PDF</div>
                <div className="text-[10px] text-slate-400">Archivos & Links</div>
              </button>

              <button
                type="button"
                onClick={() => addBlock("quiz")}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/50 transition-all text-left group"
              >
                <HelpCircle className="w-5 h-5 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                <div className="font-semibold text-xs text-white">Quiz / Ejercicio</div>
                <div className="text-[10px] text-slate-400">Preguntas</div>
              </button>
            </div>
          </div>
          {/* Agente de Clase: prepara la lección entera de una vez */}
          <ClassAgentWizard
            lessonId={lessonId}
            lessonTitle={lessonTitle}
            onApply={async (generated, plan) => {
              setBlocks((prev) => [...prev, ...generated]);
              setTeacherPlan(plan);
              await saveTeacherPlanAction(lessonId, plan);
              setMessage({
                type: "success",
                text: `Clase preparada: ${generated.length} bloques añadidos. Revísalos y pulsa Guardar.`,
              });
            }}
          />

          {/* Copiloto IA: genera contenido, actividades y quizzes en la lección */}
          <LessonAIPanel
            lessonId={lessonId}
            lessonTitle={lessonTitle}
            onBlocksGenerated={(generated) => {
              setBlocks((prev) => [...prev, ...generated]);
              setMessage({
                type: "success",
                text: `${generated.length} bloque(s) añadido(s). Revísalos y pulsa Guardar.`,
              });
            }}
            onBlocksReplaced={(generated) => {
              setBlocks(generated);
              setMessage({
                type: "success",
                text: "Contenido regenerado. Revísalo y pulsa Guardar.",
              });
            }}
          />

          <AssignmentManager lessonId={lessonId} />

          <QuizResultsPanel
            lessonId={lessonId}
            hasQuiz={blocks.some((b) => b.type === "quiz")}
          />

          <PresentationDownload
            lessonId={lessonId}
            hasContent={blocks.length > 0}
            hasUnsavedChanges={JSON.stringify(blocks) !== savedSnapshot}
            primaryColor={accentColor}
          />

          {/* Live Class URL */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 shadow-sm">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">Enlace de Clase en Vivo (Opcional)</label>
            <div className="flex items-center gap-3">
              <input
                type="url"
                value={liveUrl}
                onChange={(e) => setLiveUrl(e.target.value)}
                placeholder="https://zoom.us/j/..."
                className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 transition-colors"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">Si configuras este enlace, los alumnos verán un botón destacado para unirse a la clase en vivo al entrar a esta lección.</p>
          </div>

          {/* Blocks list */}
          <div className="space-y-4">
            {blocks.length > 0 ? (
              blocks.map((block, idx) => (
                <Fragment key={block.id}>
                {idx === 0 && (
                  <InsertHere open={insertAt === 0} onToggle={() => setInsertAt(insertAt === 0 ? null : 0)} onAdd={(type) => addBlock(type, 0)} />
                )}
                <div
                  id={block.id}
                  className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-4 relative group"
                >
                  {(block.type === "quiz" || block.type === "practice") && (() => {
                    // Ejercicio que pide un material que no trae ("lee el siguiente párrafo" sin párrafo)
                    const hasReading = blocks.some((x) => x.type === "text" && (x.content?.length ?? 0) > 400);
                    const problem = missingMaterial(block.question || "", { readingAvailable: hasReading });
                    return problem ? (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-300 text-xs">
                        <strong>Este ejercicio no se puede resolver:</strong> {problem}. Escribe el texto completo dentro del enunciado (después de dos puntos) o elimina el ejercicio antes de publicar.
                      </div>
                    ) : null;
                  })()}
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-400 text-xs font-mono font-bold">
                        Bloque #{idx + 1}
                      </span>
                      <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        {block.type === "text" && "Texto / Teoría"}
                        {block.type === "video" && "Video Interactivo"}
                        {block.type === "resource" && "Recursos / Enlace"}
                        {block.type === "quiz" && "Quiz / Ejercicio"}
                        {block.type === "chapter" && "Capítulo"}
                        {block.type === "practice" && "Ejercicio abierto"}
                        {block.type === "flashcards" && "Flashcards"}
                        {block.type === "dialogue" && "Diálogo"}
                        {block.type === "image" && "Imagen"}
                        {block.type === "mindmap" && "Mapa mental"}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <select
                        value=""
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "start") moveBlockTo(idx, 0);
                          else if (v === "end") moveBlockTo(idx, blocks.length - 1);
                          else if (v) moveBlockTo(idx, endOfChapter(Number(v), idx));
                        }}
                        title="Mover este bloque a otra parte de la lección"
                        className="max-w-[150px] mr-1 px-2 py-1 rounded-lg bg-slate-950 border border-slate-800 text-[11px] text-slate-300"
                      >
                        <option value="">Mover a…</option>
                        <option value="start">Al inicio</option>
                        {chapters.filter(({ i }) => i !== idx).map(({ b, i }) => (
                          <option key={b.id} value={i}>{`${b.emoji ?? "📂"} ${b.label ? `${b.label}: ` : ""}${b.title ?? "Capítulo"}`.slice(0, 60)}</option>
                        ))}
                        <option value="end">Al final</option>
                      </select>
                      <button
                        onClick={() => moveBlock(idx, "up")}
                        disabled={idx === 0}
                        className="p-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <MoveUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => moveBlock(idx, "down")}
                        disabled={idx === blocks.length - 1}
                        className="p-1.5 rounded-lg bg-slate-950 text-slate-400 hover:text-white disabled:opacity-30"
                      >
                        <MoveDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeBlock(block.id)}
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 ml-2"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Block Type Specific Fields */}
                  {block.type === "chapter" && (
                    <div className="space-y-3">
                      <div>
                        <label className={fieldLabel}>Título del capítulo ({block.label})</label>
                        <input value={block.title || ""} onChange={(e) => updateBlock(block.id, { title: e.target.value })} className={fieldInput} />
                      </div>
                      <div>
                        <label className={fieldLabel}>Descripción</label>
                        <textarea rows={2} value={block.content || ""} onChange={(e) => updateBlock(block.id, { content: e.target.value })} className={fieldInput} />
                      </div>
                    </div>
                  )}

                  {block.type === "practice" && (
                    <div className="space-y-3">
                      <div>
                        <label className={fieldLabel}>Enunciado</label>
                        <textarea rows={2} value={block.question || ""} onChange={(e) => updateBlock(block.id, { question: e.target.value })} className={fieldInput} />
                      </div>
                      <div>
                        <label className={fieldLabel}>Respuesta modelo (el alumno la ve al pulsar el botón)</label>
                        <textarea rows={2} value={block.answer || ""} onChange={(e) => updateBlock(block.id, { answer: e.target.value })} className={fieldInput} />
                      </div>
                      <div>
                        <label className={fieldLabel}>Imagen del ejercicio (opcional: se muestra encima del enunciado)</label>
                        {block.url && (
                          <div className="mb-2 flex items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={block.url} alt="Imagen del ejercicio" className="h-20 rounded-lg object-cover" />
                            <button type="button" onClick={() => updateBlock(block.id, { url: undefined })} className="text-xs text-slate-400 hover:text-red-400">
                              Quitar imagen
                            </button>
                          </div>
                        )}
                        {block.url && (
                          <div className="mb-3">
                            <span className="block text-[11px] text-slate-500 mb-1">Medida de la imagen</span>
                            <div className="flex flex-wrap gap-1.5">
                              {IMAGE_SIZES.map(([size, label, hint]) => (
                                <button
                                  key={size}
                                  type="button"
                                  title={hint}
                                  onClick={() => updateBlock(block.id, { imageSize: size })}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${(block.imageSize ?? "auto") === size ? "bg-blue-600/20 border-blue-500 text-white" : "border-slate-700 text-slate-400 hover:text-white"}`}
                                >
                                  {label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                        <LessonImagePicker compact onPick={(img) => updateBlock(block.id, { url: img.url })} />
                      </div>
                    </div>
                  )}

                  {block.type === "flashcards" && (
                    <div className="space-y-2">
                      {(block.cards || []).map((c, ci) => (
                        <div key={ci} className="grid grid-cols-2 gap-2">
                          <input
                            value={c.front}
                            onChange={(e) => updateBlock(block.id, { cards: (block.cards || []).map((x, xi) => (xi === ci ? { ...x, front: e.target.value } : x)) })}
                            className={fieldInput}
                          />
                          <input
                            value={c.back}
                            onChange={(e) => updateBlock(block.id, { cards: (block.cards || []).map((x, xi) => (xi === ci ? { ...x, back: e.target.value } : x)) })}
                            className={fieldInput}
                          />
                        </div>
                      ))}
                    </div>
                  )}

                  {block.type === "dialogue" && (
                    <div className="space-y-2">
                      {(block.lines || []).map((l, li) => (
                        <div key={li} className="grid grid-cols-[140px_1fr] gap-2">
                          <input
                            value={l.speaker}
                            onChange={(e) => updateBlock(block.id, { lines: (block.lines || []).map((x, xi) => (xi === li ? { ...x, speaker: e.target.value } : x)) })}
                            className={fieldInput}
                            placeholder="Personaje"
                          />
                          <input
                            value={l.text}
                            onChange={(e) => updateBlock(block.id, { lines: (block.lines || []).map((x, xi) => (xi === li ? { ...x, text: e.target.value } : x)) })}
                            className={fieldInput}
                            placeholder="Lo que dice"
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => updateBlock(block.id, { lines: [...(block.lines || []), { speaker: block.lines?.[block.lines.length - 2]?.speaker ?? "", text: "" }] })}
                        className="text-xs font-semibold text-blue-400 hover:text-blue-300"
                      >
                        + Añadir intervención
                      </button>
                    </div>
                  )}

                  {block.type === "image" && (
                    <div className="space-y-3">
                      {block.url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={block.url} alt={block.title || "Imagen"} className="max-h-56 rounded-xl" />
                      ) : (
                        <p className="text-xs text-slate-400">Elige la imagen de este bloque.</p>
                      )}
                      <LessonImagePicker onPick={(img) => updateBlock(block.id, { url: img.url, title: block.title || img.title })} />
                      {block.url && blocks.slice(0, idx).some((b) => b.type === "text") && (
                        <button
                          type="button"
                          onClick={() => attachImageToPrevious(idx)}
                          className="text-xs font-semibold text-pink-300 hover:text-pink-200"
                        >
                          ↖ Unir esta imagen a la sección de arriba (se mostrará junto a su texto)
                        </button>
                      )}
                      <div>
                        <label className={fieldLabel}>Pie de imagen (opcional)</label>
                        <input
                          value={block.title || ""}
                          onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                          placeholder="Ej. Una bicicleta en el parque"
                          className={fieldInput}
                        />
                      </div>
                    </div>
                  )}

                  {block.type === "text" && (
                    <div>
                      <label className={fieldLabel}>Subtítulo de la sección</label>
                      <input
                        value={block.title || ""}
                        onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                        placeholder="Ej. El escenario"
                        className={`${fieldInput} mb-3`}
                      />
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Contenido Teórico / Gramática (Texto o Markdown)
                      </label>
                      <textarea
                        rows={6}
                        value={block.content || ""}
                        onDrop={(e) => {
                          // Una imagen soltada en el texto pasa a ser la imagen de la sección (no su dirección pegada en el texto)
                          const url = droppedImageUrl(e);
                          if (url) {
                            e.preventDefault();
                            updateBlock(block.id, { url });
                            setMessage({ type: "success", text: "Imagen añadida a la sección. Elige su medida debajo del texto y pulsa Guardar." });
                          } else if (e.dataTransfer.files.length) {
                            e.preventDefault();
                            setMessage({ type: "error", text: "Para subir una imagen desde tu computadora usa el botón «Subir» de la imagen de la sección." });
                          }
                        }}
                        onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                        placeholder="Escribe el texto explicativo de la lección..."
                        className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500 font-sans leading-relaxed"
                      />
                      <div className="mt-3">
                        <label className={fieldLabel}>Imagen de este concepto / sección (se muestra junto al texto)</label>
                        {block.url && (
                          <div className="mb-2 flex items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={block.url} alt={block.title || "Ilustración"} className="h-20 rounded-lg object-cover" />
                            <button type="button" onClick={() => updateBlock(block.id, { url: undefined })} className="text-xs text-slate-400 hover:text-red-400">
                              Quitar imagen
                            </button>
                          </div>
                        )}
                        <LessonImagePicker compact onPick={(img) => updateBlock(block.id, { url: img.url })} />
                      </div>
                    </div>
                  )}

                  {block.type === "video" && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Título del Video</label>
                        <input
                          type="text"
                          value={block.title || ""}
                          onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                          placeholder="Ej. Explicación de Usos del Pasado"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">URL del Video (YouTube / Vimeo / MP4)</label>
                        <input
                          type="url"
                          value={block.url || ""}
                          onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                          placeholder="https://www.youtube.com/watch?v=..."
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-blue-400 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  {block.type === "resource" && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Título del Recurso</label>
                        <input
                          type="text"
                          value={block.title || ""}
                          onChange={(e) => updateBlock(block.id, { title: e.target.value })}
                          placeholder="Ej. Guía PDF de Ejercicios en Formato Imprimible"
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Subir Archivo o Ingresar URL</label>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            value={block.url || ""}
                            onChange={(e) => updateBlock(block.id, { url: e.target.value })}
                            placeholder="https://ejemplo.com/recurso.pdf o sube un archivo"
                            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm font-mono text-blue-400 focus:outline-none focus:border-blue-500"
                          />
                          <label className="flex-shrink-0 cursor-pointer px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium flex items-center justify-center gap-2 border border-slate-700 transition-colors">
                            <UploadCloud className="w-4 h-4" /> Subir
                            <input
                              type="file"
                              className="hidden"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setMessage({ type: "success", text: "Subiendo archivo..." });
                                setSaving(true);
                                try {
                                  const res = await uploadMaterialFile(file);
                                  if (res.success) {
                                    updateBlock(block.id, { url: res.fileUrl, title: block.title || res.fileName });
                                    setMessage({ type: "success", text: "Archivo subido exitosamente." });
                                  } else {
                                    setMessage({ type: "error", text: res.error });
                                  }
                                } catch (err) {
                                  setMessage({ type: "error", text: "Error de red al subir el archivo." });
                                } finally {
                                  setSaving(false);
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {block.type === "quiz" && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Pregunta del Ejercicio</label>
                        <input
                          type="text"
                          value={block.question || ""}
                          onChange={(e) => updateBlock(block.id, { question: e.target.value })}
                          placeholder="Escribe la pregunta..."
                          className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-xs font-medium text-slate-400">Opciones de Respuesta:</label>
                        {(block.options || []).map((opt, optIdx) => (
                          <div key={optIdx} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`quiz_correct_${block.id}`}
                              checked={block.correctOptionIndex === optIdx}
                              onChange={() => updateBlock(block.id, { correctOptionIndex: optIdx })}
                              className="accent-blue-500"
                              title="Marcar como respuesta correcta"
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...(block.options || [])];
                                newOpts[optIdx] = e.target.value;
                                updateBlock(block.id, { options: newOpts });
                              }}
                              className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>
                      <div>
                        <label className={fieldLabel}>Explicación (el alumno la ve al comprobar)</label>
                        <textarea rows={2} value={block.explanation || ""} onChange={(e) => updateBlock(block.id, { explanation: e.target.value })} className={fieldInput} />
                      </div>
                      <div>
                        <label className={fieldLabel}>Imagen del ejercicio (opcional: se muestra encima del enunciado)</label>
                        {block.url && (
                          <div className="mb-2 flex items-center gap-3">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={block.url} alt="Imagen del ejercicio" className="h-20 rounded-lg object-cover" />
                            <button type="button" onClick={() => updateBlock(block.id, { url: undefined })} className="text-xs text-slate-400 hover:text-red-400">
                              Quitar imagen
                            </button>
                          </div>
                        )}
                        <LessonImagePicker compact onPick={(img) => updateBlock(block.id, { url: img.url })} />
                      </div>
                    </div>
                  )}
                </div>
                <InsertHere
                  open={insertAt === idx + 1}
                  onToggle={() => setInsertAt(insertAt === idx + 1 ? null : idx + 1)}
                  onAdd={(type) => addBlock(type, idx + 1)}
                />
                </Fragment>
              ))
            ) : (
              <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center text-slate-400">
                Aún no has añadido bloques de contenido a esta lección. Usa la barra «Añadir nuevo bloque» de arriba para comenzar.
              </div>
            )}
          </div>

        </>
      ) : (
        /* Vista del alumno con actividades en modo práctica (sin guardar nota) */
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
            <p className="text-slate-400">
              Así la verá el alumno. Puedes probar las actividades: la corrección es instantánea y no se guarda nota.
              {JSON.stringify(blocks) !== savedSnapshot && <span className="text-amber-400"> Incluye cambios sin guardar.</span>}
            </p>
            {previewHref && (
              <a href={previewHref} target="_blank" rel="noopener noreferrer" className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Abrir como alumno
              </a>
            )}
          </div>
          <LessonReader
            lessonId={lessonId}
            title={lessonTitle}
            eyebrow="Vista previa"
            blocks={blocks as ReaderBlock[]}
            mode="student"
            practice
            accent={accentColor}
          />
        </div>
      )}
    </div>
  );
}
