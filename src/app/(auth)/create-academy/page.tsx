"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createAcademyAction } from "@/app/actions/academy.actions";
import { Sparkles, ArrowRight, ArrowLeft, CheckCircle2, School, Palette, AlertCircle } from "lucide-react";
import { NLogoBadge } from "@/components/landing/NLogoBadge";
import { ParallaxBackground } from "@/components/landing/ParallaxBackground";
import { ThemeToggle } from "@/components/landing/ThemeToggle";
import { DEFAULT_BRAND_BACKGROUND } from "@/lib/brand-theme";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n/client";
import { rich } from "@/i18n/format";

function CreateAcademyContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t: d } = useI18n();
  const t = d.createAcademy;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    language: "es",
    userEmail: "",
    userName: "",
    password: "",
    primaryColor: "#3B82F6",
    secondaryColor: DEFAULT_BRAND_BACKGROUND,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setError(null);
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === "name" && !prev.slug) {
        updated.slug = value.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^\w\-]+/g, "");
      }
      return updated;
    });
  };

  const validateStep = (currentStep: number): boolean => {
    setError(null);

    if (currentStep === 1) {
      if (!formData.name.trim() || formData.name.trim().length < 3) {
        setError(t.errors.nameTooShort);
        return false;
      }
      if (!formData.slug.trim()) {
        setError(t.errors.slugRequired);
        return false;
      }
    }

    if (currentStep === 2) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!formData.userEmail.trim() || !emailRegex.test(formData.userEmail.trim())) {
        setError(t.errors.emailInvalid);
        return false;
      }
      if (formData.password.length < 8) {
        setError(t.errors.passwordShort);
        return false;
      }
    }

    return true;
  };

  const handleNextStep = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 3));
    }
  };

  const handlePrevStep = () => {
    setError(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Si aún no está en el paso 3, avanzar al siguiente paso al presionar Enter
    if (step < 3) {
      handleNextStep();
      return;
    }

    if (!validateStep(1)) {
      setStep(1);
      return;
    }

    if (!validateStep(2)) {
      setStep(2);
      return;
    }

    if (!acceptTerms) {
      setError(t.errors.acceptTerms);
      return;
    }

    setLoading(true);
    setError(null);

    const body = new FormData();
    Object.entries(formData).forEach(([key, val]) => body.append(key, val));
    body.append("acceptTerms", "on");

    try {
      const res = await createAcademyAction(body);

      if (res.success && res.data) {
        // Primero hay que confirmar el correo; el enlace del email lleva luego a Facturación
        router.push("/confirmar-email");
      } else {
        setError(res.error || t.errors.generic);
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message || t.errors.network);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-slate-900 dark:text-slate-100 flex items-center justify-center p-6 selection:bg-amber-500 selection:text-slate-950 relative overflow-hidden font-sans transition-colors duration-300">
      {/* 3D Multi-layer Interactive Parallax Background */}
      <ParallaxBackground />

      <div className="w-full max-w-xl relative z-10">
        {/* Top bar theme toggle */}
        <div className="flex justify-end gap-2 mb-4">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>

        {/* Header Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <NLogoBadge size="md" />
            <div className="text-left">
              <span className="font-extrabold text-2xl tracking-tight gold-gradient-text">
                Mentor Studio Global
              </span>
              <span className="block text-[10px] text-sky-700 dark:text-sky-400 font-mono tracking-widest uppercase font-semibold">
                {d.common.tagline}
              </span>
            </div>
          </Link>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-8 px-4">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex items-center gap-2 text-sm text-left transition-colors ${
              step >= 1 ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-slate-500"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                step >= 1
                  ? "gold-gradient-bg text-slate-950 shadow-lg shadow-amber-500/20"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
              }`}
            >
              1
            </div>
            <span>{t.steps.school}</span>
          </button>
          <div className="h-0.5 w-12 bg-slate-300 dark:bg-slate-800" />
          <button
            type="button"
            onClick={() => validateStep(1) && setStep(2)}
            className={`flex items-center gap-2 text-sm text-left transition-colors ${
              step >= 2 ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-slate-500"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                step >= 2
                  ? "gold-gradient-bg text-slate-950 shadow-lg shadow-amber-500/20"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
              }`}
            >
              2
            </div>
            <span>{t.steps.teaching}</span>
          </button>
          <div className="h-0.5 w-12 bg-slate-300 dark:bg-slate-800" />
          <button
            type="button"
            onClick={() => validateStep(1) && validateStep(2) && setStep(3)}
            className={`flex items-center gap-2 text-sm text-left transition-colors ${
              step >= 3 ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-slate-500"
            }`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                step >= 3
                  ? "gold-gradient-bg text-slate-950 shadow-lg shadow-amber-500/20"
                  : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
              }`}
            >
              3
            </div>
            <span>{t.steps.branding}</span>
          </button>
        </div>

        {/* Card Container */}
        <div className="p-8 rounded-3xl glass-gold-card shadow-2xl border border-amber-500/40 relative">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 flex items-center gap-2">
              <School className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              {step === 1 && t.step1Title}
              {step === 2 && t.step2Title}
              {step === 3 && t.step3Title}
            </h1>
            <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
              {step === 1 && t.step1Subtitle}
              {step === 2 && t.step2Subtitle}
              {step === 3 && t.step3Subtitle}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-700 dark:text-red-400 text-sm font-semibold flex items-center gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-2">
                    {t.name}
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    value={formData.name}
                    onChange={handleChange}
                    placeholder={t.namePlaceholder}
                    className="w-full px-4 py-3 glass-panel border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 transition-colors text-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-2">
                    {t.slug}
                  </label>
                  <div className="flex items-center rounded-xl glass-panel border border-slate-300 dark:border-slate-700 overflow-hidden px-4 py-3 focus-within:border-amber-500 transition-colors">
                    <span className="text-slate-500 dark:text-slate-400 text-sm font-mono mr-1">mentorstudioglobal.com/a/</span>
                    <input
                      type="text"
                      name="slug"
                      required
                      value={formData.slug}
                      onChange={handleChange}
                      placeholder={t.slugPlaceholder}
                      className="bg-transparent w-full text-amber-600 dark:text-amber-400 font-mono font-semibold focus:outline-none text-sm"
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-2">
                    {t.email}
                  </label>
                  <input
                    type="email"
                    name="userEmail"
                    required
                    value={formData.userEmail}
                    onChange={handleChange}
                    placeholder={d.auth.login.emailPlaceholder}
                    className="w-full px-4 py-3 glass-panel border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 transition-colors text-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-2">
                    {t.password}
                  </label>
                  <input
                    type="password"
                    name="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 glass-panel border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 transition-colors text-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-2">
                    {t.fullName}
                  </label>
                  <input
                    type="text"
                    name="userName"
                    value={formData.userName}
                    onChange={handleChange}
                    placeholder={t.fullNamePlaceholder}
                    className="w-full px-4 py-3 glass-panel border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-amber-500 transition-colors text-sm font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-2">
                    {t.teachingLanguage}
                  </label>
                  <select
                    name="language"
                    value={formData.language}
                    onChange={handleChange}
                    className="w-full px-4 py-3 glass-panel border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition-colors text-sm font-medium"
                  >
                    <option value="es" className="bg-slate-900 text-white">{t.languages.es}</option>
                    <option value="en" className="bg-slate-900 text-white">{t.languages.en}</option>
                    <option value="fr" className="bg-slate-900 text-white">{t.languages.fr}</option>
                    <option value="de" className="bg-slate-900 text-white">{t.languages.de}</option>
                    <option value="pt" className="bg-slate-900 text-white">{t.languages.pt}</option>
                    <option value="it" className="bg-slate-900 text-white">{t.languages.it}</option>
                  </select>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 dark:text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Palette className="w-4 h-4 text-amber-600 dark:text-amber-400" /> {t.primaryColor}
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      name="primaryColor"
                      value={formData.primaryColor}
                      onChange={handleChange}
                      className="w-12 h-12 rounded-xl glass-panel border border-slate-300 dark:border-slate-700 cursor-pointer"
                    />
                    <input
                      type="text"
                      name="primaryColor"
                      value={formData.primaryColor}
                      onChange={handleChange}
                      className="flex-1 px-4 py-3 glass-panel border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 transition-colors text-sm font-medium"
                    />
                  </div>
                </div>

                {/* Previsualización rápida */}
                <div className="p-4 rounded-xl border border-slate-300 dark:border-slate-800 glass-panel mt-4">
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-2 font-mono uppercase font-semibold">
                    {t.preview}
                  </div>
                  <div
                    className="p-4 rounded-xl text-white font-bold flex items-center justify-between shadow-lg"
                    style={{ backgroundColor: formData.primaryColor }}
                  >
                    <span>{formData.name || t.previewFallback}</span>
                    <Sparkles className="w-5 h-5 text-white/80" />
                  </div>
                </div>

                <label className="flex items-start gap-3 mt-4 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(e) => {
                      setAcceptTerms(e.target.checked);
                      setError(null);
                    }}
                    className="mt-0.5 w-4 h-4 accent-amber-500"
                  />
                  <span>
                    {rich(t.acceptTerms, {
                      terms: <Link href="/terms" target="_blank" className="underline font-semibold">{d.common.terms}</Link>,
                      privacy: <Link href="/privacy" target="_blank" className="underline font-semibold">{d.common.privacy}</Link>,
                      refunds: <Link href="/refunds" target="_blank" className="underline font-semibold">{d.common.refunds}</Link>,
                    })}
                  </span>
                </label>
              </div>
            )}

            <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handlePrevStep}
                  className="px-4 py-2.5 rounded-xl glass-panel text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-2 text-sm font-semibold"
                >
                  <ArrowLeft className="w-4 h-4" /> {t.previous}
                </button>
              ) : (
                <div />
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-6 py-2.5 rounded-xl gold-gradient-bg text-slate-950 font-bold transition-all shadow-lg shadow-amber-500/25 flex items-center gap-2 text-sm hover:scale-105"
                >
                  <span>{t.next}</span> <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3.5 rounded-xl gold-gradient-bg text-slate-950 font-bold transition-all shadow-lg shadow-amber-500/25 flex items-center gap-2 disabled:opacity-50 text-sm hover:scale-105"
                >
                  <span>{loading ? t.creating : t.launch}</span> <CheckCircle2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Back Link */}
        <div className="text-center mt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            {d.common.backHome}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CreateAcademyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <CreateAcademyContent />
    </Suspense>
  );
}
