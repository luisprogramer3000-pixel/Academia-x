"use client";

import { useState } from "react";
import { updateBrandingAction } from "@/app/actions/academy.actions";
import { uploadLogoAction } from "@/app/actions/upload.actions";
import { Save, CheckCircle2, AlertCircle, Sparkles, Globe } from "lucide-react";
import { BrandScope, DEFAULT_BRAND_BACKGROUND } from "@/lib/brand-theme";

interface BrandingSettingsFormProps {
  tenantId: string;
  initialName: string;
  initialPrimaryColor: string;
  initialSecondaryColor: string;
  initialLogoUrl: string;
  slug: string;
}

export function BrandingSettingsForm({
  tenantId,
  initialName,
  initialPrimaryColor,
  initialSecondaryColor,
  initialLogoUrl,
  slug,
}: BrandingSettingsFormProps) {
  const [name, setName] = useState(initialName);
  const [primaryColor, setPrimaryColor] = useState(initialPrimaryColor || "#3B82F6");
  const [secondaryColor, setSecondaryColor] = useState(initialSecondaryColor || DEFAULT_BRAND_BACKGROUND);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    let finalLogoUrl = logoUrl;
    if (logoFile) {
      const fileData = new FormData();
      fileData.append("file", logoFile);
      const uploadRes = await uploadLogoAction(fileData);
      if (!uploadRes.success) {
        setMessage({ type: "error", text: uploadRes.error || "Error al subir logo." });
        setSaving(false);
        return;
      }
      finalLogoUrl = uploadRes.logoUrl || logoUrl;
    }

    const formData = new FormData();
    formData.append("tenantId", tenantId);
    formData.append("name", name);
    formData.append("primaryColor", primaryColor);
    formData.append("secondaryColor", secondaryColor);
    formData.append("logoUrl", finalLogoUrl);

    const res = await updateBrandingAction(formData);

    if (res.success) {
      setMessage({ type: "success", text: "¡Branding guardado correctamente!" });
    } else {
      setMessage({ type: "error", text: res.error || "Ocurrió un error al guardar los cambios." });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-8">
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

      <form onSubmit={handleSubmit} className="p-8 rounded-3xl bg-slate-900 border border-slate-800 shadow-xl space-y-6">
        <input type="hidden" name="tenantId" value={tenantId} />

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Nombre de la Academia
          </label>
          <input
            type="text"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500 transition-colors text-sm font-medium"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Logo de la Academia (Imagen)
          </label>
          <div className="flex items-center gap-4">
            {logoUrl && (
              <img src={logoUrl} alt="Logo" className="w-12 h-12 rounded-xl object-cover bg-slate-950 border border-slate-800" />
            )}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setLogoFile(e.target.files[0]);
                  setLogoUrl(URL.createObjectURL(e.target.files[0]));
                }
              }}
              className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 focus:outline-none focus:border-blue-500 transition-colors text-sm file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Color principal (botones y acentos)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer"
              />
              <input
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-slate-200 focus:outline-none text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Color de fondo (web, campus y lecciones)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer"
              />
              <input
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                className="flex-1 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-slate-200 focus:outline-none text-sm"
              />
            </div>
          </div>
        </div>

        {/* Live Preview Section */}
        <div className="pt-6 border-t border-slate-800">
          <span className="block text-xs font-mono font-semibold text-slate-400 uppercase tracking-wider mb-3">
            Previsualización en Tiempo Real:
          </span>

          <BrandScope color={secondaryColor} className="p-6 rounded-2xl border border-slate-800 transition-all shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {logoUrl ? (
                  <img src={logoUrl} alt="Logo" className="w-10 h-10 rounded-xl object-cover shadow-md" />
                ) : (
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-md text-base"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {name ? name.slice(0, 2).toUpperCase() : "MS"}
                  </div>
                )}
                <div>
                  <h4 className="font-bold text-white text-base leading-tight">{name || "Tu Academia"}</h4>
                  <span className="text-xs text-blue-400 flex items-center gap-1 font-mono">
                    <Globe className="w-3 h-3" /> mentorstudioglobal.com/a/{slug || "mi-escuela"}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-lg transition-transform hover:scale-105"
                style={{ backgroundColor: primaryColor }}
              >
                Inscribirse
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
              <span>Curso de Muestra: Español Profesional B2</span>
              <span className="font-bold text-white">$149 USD</span>
            </div>
            <p className="mt-3 text-xs text-slate-400">Así se verán tu página pública, el campus y las lecciones de tus alumnos.</p>
          </BrandScope>
        </div>

        <div className="pt-6 border-t border-slate-800 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors flex items-center gap-2 shadow-lg shadow-blue-600/30 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? "Guardando Cambios..." : "Guardar Cambios de Branding"}
          </button>
        </div>
      </form>
    </div>
  );
}
