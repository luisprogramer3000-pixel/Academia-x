"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLessonWithAIAction, type LessonJobResult } from "@/app/actions/ai.actions";
import { waitForAIJob, LOST_CONNECTION_ERROR } from "@/lib/ai-job-client";
import { ClassPlanForm } from "../../../class-plan/ClassPlanForm";

export function NewLessonAI() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <ClassPlanForm
      hideHeader
      pending={pending}
      error={error}
      submitLabel="Crear lección con IA"
      onSubmit={(fd) => {
        setError(null);
        startTransition(async () => {
          let res: LessonJobResult;
          try {
            const started = await createLessonWithAIAction(fd);
            if (!started.success) return setError(started.error);
            res = await waitForAIJob<LessonJobResult>(started.jobId);
          } catch (err) {
            return setError(err instanceof Error && err.message ? err.message : LOST_CONNECTION_ERROR);
          }
          const img = res.images.requested ? `&img=${res.images.generated}-${res.images.requested}` : "";
          router.push(`/dashboard/lessons/${res.lessonId}?nueva=1${img}`);
        });
      }}
    />
  );
}
