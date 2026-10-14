"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const applyTheme = (newTheme: "dark" | "light") => {
    setTheme(newTheme);
    localStorage.setItem("ax_theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    }
  };

  useEffect(() => {
    const savedTheme = localStorage.getItem("ax_theme") as "dark" | "light" | null;
    const initialTheme = savedTheme || "dark";
    applyTheme(initialTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      type="button"
      aria-label="Toggle Theme"
      className="p-2.5 rounded-xl glass-panel text-amber-500 hover:text-amber-400 hover:border-amber-400/50 transition-all duration-300 shadow-md flex items-center justify-center cursor-pointer"
      title={theme === "dark" ? "Cambiar a Modo Claro VIP" : "Cambiar a Modo Oscuro VIP"}
    >
      {theme === "dark" ? (
        <Sun className="w-4.5 h-4.5 text-amber-400" />
      ) : (
        <Moon className="w-4.5 h-4.5 text-sky-600" />
      )}
    </button>
  );
}
