/** Diferencias menores a este monto se tratan como redondeo, no como abono */
export const UMBRAL_REDONDEO_PAGO = 1_000;

export const RANGE_COLORS: Record<string, string> = {
  "Al dia": "#22c55e",
  "1-5 dias": "#4ade80",
  "6-10 dias": "#facc15",
  "11-15 dias": "#eab308",
  "16-20 dias": "#f59e0b",
  "21-30 dias": "#f97316",
  "31-60 dias": "#ef4444",
  "61-90 dias": "#dc2626",
  "90+ dias": "#991b1b",
};

export const SEVERITY_GRUPOS: readonly { key: string; label: string; color: string; rangos: string[] }[] = [
  {
    key: "tolerable",
    label: "Tolerable",
    color: "#22c55e",
    rangos: ["Al dia", "1-5 dias"],
  },
  {
    key: "atencion",
    label: "Atencion",
    color: "#eab308",
    rangos: ["6-10 dias", "11-15 dias", "16-20 dias"],
  },
  {
    key: "critico",
    label: "Critico",
    color: "#ef4444",
    rangos: ["21-30 dias", "31-60 dias", "61-90 dias", "90+ dias"],
  },
];
