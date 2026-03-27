export function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

export function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatFechaCorta(fecha: string | null): string {
  if (!fecha) return "-";
  const d = new Date(fecha + "T00:00:00");
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/** Formato legible para detalle. Ej: `10 mar 2026` */
export function formatFechaLarga(fecha: string | null): string {
  if (!fecha) return "-";
  const d = new Date(fecha + "T00:00:00");
  return d.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

/** Fecha relativa para timeline. Ej: `Hoy`, `Ayer`, `Hace 3 dias`, `10 mar 2026` */
export function formatFechaRelativa(fechaISO: string): string {
  const ahora = new Date();
  const d = new Date(fechaISO);
  const diffMs = ahora.getTime() - d.getTime();
  const diffDias = Math.floor(diffMs / 86400000);

  if (diffDias === 0) return "Hoy";
  if (diffDias === 1) return "Ayer";
  if (diffDias < 7) return `Hace ${diffDias} dias`;
  return formatFechaLarga(fechaISO.split("T")[0]);
}

/** Header de grupo para timeline. Ej: `Marzo 2026` */
export function formatMesGrupo(fechaISO: string): string {
  const d = new Date(fechaISO);
  const mes = d.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
  return mes.charAt(0).toUpperCase() + mes.slice(1);
}
