export type Severidad = "tolerable" | "atencion" | "critico";

// Thresholds: <=5 tolerable, 6-20 atencion, >20 critico
export function getSeveridad(mora: number): Severidad {
  if (mora <= 5) return "tolerable";
  if (mora <= 20) return "atencion";
  return "critico";
}

export const SEVERIDAD_CONFIG = {
  tolerable: {
    label: "Tolerable",
    rango: "0-5 dias de mora",
    text: "text-green-600",
    bg: "bg-green-50",
    border: "border-l-green-500",
    badge: "bg-green-100 text-green-700",
    chip: "bg-green-50 border-green-200 text-green-700",
    chipActive: "bg-green-600 text-white border-green-600",
  },
  atencion: {
    label: "Atencion",
    rango: "6-20 dias de mora",
    text: "text-yellow-600",
    bg: "bg-yellow-50",
    border: "border-l-yellow-500",
    badge: "bg-yellow-100 text-yellow-700",
    chip: "bg-yellow-50 border-yellow-200 text-yellow-700",
    chipActive: "bg-yellow-500 text-white border-yellow-500",
  },
  critico: {
    label: "Critico",
    rango: "mas de 20 dias",
    text: "text-red-600",
    bg: "bg-red-50",
    border: "border-l-red-500",
    badge: "bg-red-100 text-red-700",
    chip: "bg-red-50 border-red-200 text-red-700",
    chipActive: "bg-red-600 text-white border-red-600",
  },
} as const;

export function getMoraBadgeStyles(mora: number): { label: string; classes: string } {
  if (mora <= 0) return { label: "Al dia", classes: "bg-slate-100 text-slate-600" };
  const sev = getSeveridad(mora);
  return { label: `${mora}d`, classes: SEVERIDAD_CONFIG[sev].badge };
}

export const SEVERIDADES = [
  { value: "tolerable" as const, label: "Tolerable", bg: SEVERIDAD_CONFIG.tolerable.chip, activeBg: SEVERIDAD_CONFIG.tolerable.chipActive },
  { value: "atencion" as const, label: "Atencion", bg: SEVERIDAD_CONFIG.atencion.chip, activeBg: SEVERIDAD_CONFIG.atencion.chipActive },
  { value: "critico" as const, label: "Critico", bg: SEVERIDAD_CONFIG.critico.chip, activeBg: SEVERIDAD_CONFIG.critico.chipActive },
] as const;

export const RANGOS = [
  { value: "al_dia", label: "Al dia" },
  { value: "1-5", label: "1-5 dias" },
  { value: "6-10", label: "6-10 dias" },
  { value: "11-15", label: "11-15 dias" },
  { value: "16-20", label: "16-20 dias" },
  { value: "21-30", label: "21-30 dias" },
  { value: "31-60", label: "31-60 dias" },
  { value: "61-90", label: "61-90 dias" },
  { value: "90+", label: "90+ dias" },
] as const;

export function getCupoBarColor(pct: number): string {
  if (pct > 100) return "bg-red-500";
  if (pct > 80) return "bg-yellow-500";
  return "bg-green-500";
}
