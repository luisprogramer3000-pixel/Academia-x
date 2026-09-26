"use client";

import { useState } from "react";
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
} from "lucide-react";
import { uploadMaterialAction } from "@/app/actions/upload.actions";

export interface LessonBlock {
  id: string;
  type: "text" | "video" | "resource" | "quiz";
  title?: string;
  content?: string;
  url?: string;
  question?: string;
  options?: string[];
  correctOptionIndex?: number;
}

interface LessonBlockEditorProps {
  lessonId: string;
  courseId: string;
  lessonTitle: string;
  initialContentJson?: string | null;
  initialLiveUrl?: string | null;
  tenantSlug: string;
}

export function LessonBlockEditor({
  lessonId,
  courseId,
  lessonTitle,
  initialContentJson,
  initialLiveUrl,
  tenantSlug,
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
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  const addBlock = (type: LessonBlock["type"]) => {
    const newBlock: LessonBlock = {
      id: `block_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      type,
      title: type === "video" ? "Video de la Lección" : type === "resource" ? "Material Descargable" : "",
      content: type === "text" ? "Escribe aquí la teoría o contenido explicativo de la lección..." : "",
      url: type === "video" ? "https://www.youtube.com/watch?v=dQw4w9WgXcQ" : "",
      question: type === "quiz" ? "¿Cuál de las siguientes frases expresa una hipótesis en el pasado?" : "",
      options: type === "quiz" ? ["Si hubiera sabido...", "Si sé...", "Cuando supe...", "Sabiendo que..."] : [],
      correctOptionIndex: 0,
    };
    setBlocks((prev) => [...prev, newBlock]);
  };

  const removeBlock = (id: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  };

  const moveBlock = (index: number, direction: "up" | "down") => {
    if ((direction === "up" && index === 0) || (direction === "down" && index === blocks.length - 1)) return;
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const updated = [...blocks];
    const [moved] = updated.splice(index, 1);
    updated.splice(targetIndex, 0, moved);
    setBlocks(updated);
  };

  const updateBlock = (id: string, updates: Partial<LessonBlock>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...updates } : b)));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const contentJson = JSON.stringify({ blocks });
      await updateLessonContentAction(lessonId, contentJson);
      
      const formData = new FormData();
      if (liveUrl) formData.set("liveUrl", liveUrl);
      await updateLessonSettingsAction(lessonId, formData);

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

      {activeTab === "edit" ? (
        <>
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
                <div
                  key={block.id}
                  className="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all space-y-4 relative group"
                >
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
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
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
                  {block.type === "text" && (
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">
                        Contenido Teórico / Gramática (Texto o Markdown)
                      </label>
                      <textarea
                        rows={4}
                        value={block.content || ""}
                        onChange={(e) => updateBlock(block.id, { content: e.target.value })}
                        placeholder="Escribe el texto explicativo de la lección..."
                        className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-blue-500 font-sans leading-relaxed"
                      />
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
                                const formData = new FormData();
                                formData.append("file", file);
                                setMessage({ type: "success", text: "Subiendo archivo..." });
                                setSaving(true);
                                try {
                                  const res = await uploadMaterialAction(formData);
                                  if (res.success && res.fileUrl) {
                                    updateBlock(block.id, { url: res.fileUrl, title: block.title || res.fileName });
                                    setMessage({ type: "success", text: "Archivo subido exitosamente." });
                                  } else {
                                    setMessage({ type: "error", text: res.error || "Error al subir el archivo." });
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
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="p-12 rounded-3xl bg-slate-900 border border-slate-800 text-center text-slate-400">
                Aún no has añadido bloques de contenido a esta lección. Usa la barra inferior para comenzar.
              </div>
            )}
          </div>

          {/* Add Block Toolbar */}
          <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
            <span className="block text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider mb-4">
              Añadir Nuevo Bloque a la Lección:
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
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
        </>
      ) : (
        /* Preview mode */
        <div className="p-8 rounded-3xl bg-slate-900 border border-slate-800 space-y-6">
          <h3 className="text-2xl font-bold text-white border-b border-slate-800 pb-4">{lessonTitle}</h3>
          {blocks.length > 0 ? (
            blocks.map((block) => (
              <div key={block.id} className="space-y-4">
                {block.type === "text" && (
                  <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">{block.content}</p>
                )}
                {block.type === "video" && (
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
                    <span className="text-xs text-indigo-400 font-mono block mb-2">{block.title}</span>
                    <div className="aspect-video bg-slate-900 rounded-lg flex items-center justify-center text-slate-400 text-xs font-mono">
                      [ Reproductor de Video: {block.url} ]
                    </div>
                  </div>
                )}
                {block.type === "resource" && (
                  <a
                    href={block.url || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-500/40 transition-colors flex items-center justify-between text-xs text-emerald-400 font-semibold"
                  >
                    <span>📄 {block.title}</span>
                    <span>Descargar</span>
                  </a>
                )}
                {block.type === "quiz" && (
                  <div className="p-5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <h4 className="font-bold text-sm text-white">❓ {block.question}</h4>
                    <div className="space-y-2">
                      {(block.options || []).map((opt, i) => (
                        <div
                          key={i}
                          className={`p-3 rounded-lg text-xs font-medium border ${
                            i === block.correctOptionIndex
                              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                              : "bg-slate-900 border-slate-800 text-slate-300"
                          }`}
                        >
                          {opt} {i === block.correctOptionIndex && "(Respuesta Correcta)"}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-slate-400 text-sm text-center py-8">Esta lección no tiene bloques aún.</div>
          )}
        </div>
      )}
    </div>
  );
}
