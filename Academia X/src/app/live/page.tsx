import type { Metadata } from "next";
import { JoinCodeForm } from "./JoinCodeForm";

export const metadata: Metadata = { title: "Unirse al quiz en vivo" };

export default function LiveJoinPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-700 via-purple-700 to-fuchsia-700 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-4xl font-black text-white mb-8">Quiz en vivo</h1>
        <JoinCodeForm />
      </div>
    </div>
  );
}
