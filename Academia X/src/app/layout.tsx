import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Virtual Language School in a Box — Mentor Studio Global",
  description: "Crea tu propia academia de idiomas online, administra tus alumnos, vende tus cursos y utiliza IA para enseñar mejor.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" data-theme="dark">
      <body className="antialiased min-h-screen bg-[var(--background)] text-[var(--foreground)] transition-colors duration-300">
        {children}
      </body>
    </html>
  );
}
