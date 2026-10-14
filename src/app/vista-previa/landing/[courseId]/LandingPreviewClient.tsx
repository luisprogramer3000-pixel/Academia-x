"use client";

import { useEffect, useState } from "react";
import { CourseLandingView, type CourseLandingContent, type CourseLandingViewProps } from "@/components/landing/course-landing/CourseLandingView";
import { landingDraftKey } from "@/components/landing/course-landing/draft";

/** Muestra el borrador del panel (localStorage) y se actualiza en vivo al editarlo. */
export function LandingPreviewClient({
  courseId,
  saved,
  view,
}: {
  courseId: string;
  saved: CourseLandingContent | null;
  view: Omit<CourseLandingViewProps, "landing">;
}) {
  const [landing, setLanding] = useState<CourseLandingContent | null>(saved);

  useEffect(() => {
    const key = landingDraftKey(courseId);
    const read = () => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) setLanding(JSON.parse(raw));
      } catch {
        // Sin acceso al almacenamiento: se muestra la versión guardada
      }
    };
    read();
    const onStorage = (e: StorageEvent) => e.key === key && read();
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [courseId]);

  return <CourseLandingView {...view} landing={landing} />;
}
