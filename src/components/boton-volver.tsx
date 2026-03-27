"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface BotonVolverProps {
  fallbackHref: string;
  label: string;
}

export function BotonVolver({ fallbackHref, label }: BotonVolverProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 cursor-pointer"
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
