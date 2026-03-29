export function buildPageUrl(
  rutaBase: string,
  targetPage: number,
  filters: Record<string, string | undefined>,
): string {
  const p = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value) p.set(key === "busqueda" ? "q" : key, value);
  }
  p.set("page", String(targetPage));
  return `${rutaBase}?${p.toString()}`;
}
