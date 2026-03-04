/**
 * Utilidades de formato de moneda centralizadas.
 * Reemplaza las 5 copias locales de formatCurrency en las paginas.
 */

// Formato corto para dashboards y graficos (K/M)
export function formatCurrencyShort(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(0)}K`;
  }
  return `$${value.toFixed(0)}`;
}

// Formato completo para tablas y detalles (ej: $1.234.567)
export function formatCurrencyFull(value: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
