"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

function getThemeSnapshot(): boolean {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot(): boolean {
  return false;
}

export function ThemeToggle() {
  const subscribe = useCallback((callback: () => void) => {
    // Inicializar desde localStorage al montar
    const stored = localStorage.getItem("theme");
    if (stored === "dark") {
      document.documentElement.classList.add("dark");
    }
    // Observer para cambios en classList
    const observer = new MutationObserver(callback);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  const dark = useSyncExternalStore(subscribe, getThemeSnapshot, getServerSnapshot);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      aria-label={dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {dark ? (
        <Sun className="h-5 w-5 text-amber-500" />
      ) : (
        <Moon className="h-5 w-5 text-slate-600" />
      )}
    </button>
  );
}
