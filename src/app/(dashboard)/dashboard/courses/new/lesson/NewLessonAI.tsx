"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createLessonWithAIAction } from "@/app/actions/ai.actions";
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
          const res = await createLessonWithAIAction(fd);
          if (!res.success) return setError(res.error);
          const img = res.images.requested ? `&img=${res.images.generated}-${res.images.requested}` : "";
          router.push(`/dashboard/lessons/${res.lessonId}?nueva=1${img}`);
        });
      }}
    />
  );
}
