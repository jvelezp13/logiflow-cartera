export function buildPageUrl(
  rutaBase: string,
  targetPage: number,
  filters: { busqueda?: string; ciudad?: string; severidad?: string; rango?: string },
): string {
  const p = new URLSearchParams();
  if (filters.busqueda) p.set("q", filters.busqueda);
  if (filters.ciudad) p.set("ciudad", filters.ciudad);
  if (filters.severidad) p.set("severidad", filters.severidad);
  if (filters.rango) p.set("rango", filters.rango);
  p.set("page", String(targetPage));
  return `${rutaBase}?${p.toString()}`;
}
