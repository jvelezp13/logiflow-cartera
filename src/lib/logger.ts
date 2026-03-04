/**
 * Logger centralizado. Solo imprime en desarrollo.
 */
export function logError(message: string, error?: unknown): void {
  if (process.env.NODE_ENV === "development") {
    console.error(`[Logiflow] ${message}`, error);
  }
}
