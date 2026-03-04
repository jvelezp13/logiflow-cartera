"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toggleCastigadaCookie } from "@/lib/castigada-action";

interface ToggleCastigadaProps {
  incluirCastigada: boolean;
}

export function ToggleCastigada({ incluirCastigada }: ToggleCastigadaProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      await toggleCastigadaCookie(!incluirCastigada);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium
        border transition-colors
        ${incluirCastigada
          ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
        }
        ${isPending ? "opacity-50" : ""}
      `}
      aria-label={incluirCastigada ? "Ocultar cartera castigada" : "Incluir cartera castigada"}
    >
      <span className={`
        inline-block w-7 h-4 rounded-full relative transition-colors
        ${incluirCastigada ? "bg-red-500" : "bg-slate-300"}
      `}>
        <span className={`
          absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform
          ${incluirCastigada ? "translate-x-3.5" : "translate-x-0.5"}
        `} />
      </span>
      Castigada (90+)
    </button>
  );
}
