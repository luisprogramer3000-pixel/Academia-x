import type { Metadata } from "next";
import { LivePlayerClient } from "./LivePlayerClient";

export const metadata: Metadata = { title: "Quiz en vivo" };

export default async function LivePlayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <LivePlayerClient code={code.replace(/\D/g, "").slice(0, 6)} />;
}
