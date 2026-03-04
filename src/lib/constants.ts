/**
 * Constantes centralizadas del proyecto.
 * Reemplaza las copias duplicadas de COLORS en dashboard y envejecimiento.
 */

// Colores para graficos de envejecimiento (verde -> rojo oscuro)
export const CHART_COLORS = ["#22c55e", "#eab308", "#f97316", "#ef4444", "#991b1b"];

// Colores por severidad de alertas
export const SEVERITY_COLORS = {
  critica: "#dc2626",
  alta: "#f97316",
  media: "#eab308",
  baja: "#22c55e",
} as const;
