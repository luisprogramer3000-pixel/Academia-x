"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ClassPlanJobResult } from "@/app/actions/ai.actions";
import { runAIJob, LOST_CONNECTION_ERROR } from "@/lib/ai-job-client";
import type { ClassPlanOutput } from "@/modules/ai/class-plan.schema";
import { ClassPlanForm } from "./ClassPlanForm";
import { ClassPlanView } from "./ClassPlanView";

export function ClassPlanClient() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Solo se usa si el plan no se pudo guardar en "Mis recursos"
  const [unsavedPlan, setUnsavedPlan] = useState<ClassPlanOutput | null>(null);

  function handleSubmit(fd: FormData) {
    setError(null);
    startTransition(async () => {
      let res: ClassPlanJobResult;
      try {
        res = await runAIJob<ClassPlanJobResult>("/api/ai/class-plan", fd);
      } catch (err) {
        setError(err instanceof Error && err.message ? err.message : LOST_CONNECTION_ERROR);
        return;
      }
      if (res.resourceId) {
        router.push(`/dashboard/resources/${res.resourceId}?nuevo=1`);
      } else {
        setUnsavedPlan(res.plan);
        window.scrollTo({ top: 0 });
      }
    });
  }

  if (unsavedPlan) {
    return (
      <ClassPlanView
        plan={unsavedPlan}
        onReset={() => setUnsavedPlan(null)}
        notice={
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-sm">
            El plan se generó pero no se pudo guardar en "Mis recursos". Descárgalo antes de salir de esta página.
          </div>
        }
      />
    );
  }

  return (
    <div className="max-w-3xl">
      <ClassPlanForm pending={pending} error={error} onSubmit={handleSubmit} />
    </div>
  );
}
