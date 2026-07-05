import type { UserProfile } from "./get-tenant";

/** Código de error de las acciones bloqueadas en modo soporte. */
export const SUPPORT_MODE_BLOCKED = "SUPPORT_MODE_BLOCKED";

/**
 * Contrato de modo soporte: un super_admin operando un tenant != su home puede
 * LEER el tenant destino en todos los dominios de Cartera, y las escrituras de plata
 * (pagos, auditoría, notas) quedan gateadas por la RLS app-aware de la base
 * (has_app_tenant_role sobre el tenant activo), no por este guard.
 *
 * Hoy este guard es efectivamente un no-op para la operación normal: para admin/viewer
 * is_support_mode es SIEMPRE false (solo el super_admin puede entrar en modo soporte).
 * Se deja implementado como punto de bloqueo explícito para acciones que NO son
 * tenant-activo-coherentes y que la RLS por sí sola no cubriría:
 *   1. Writes cross-dominio cuyo RPC resuelve el tenant HOME-estricto internamente
 *      -> en modo soporte operarían sobre el home del super_admin, no sobre el tenant
 *      que está viendo. (En Cartera hoy no existen: las 4 RPCs de pagos ya reciben y
 *      validan p_tenant_id app-aware.)
 *   2. Side-effects externos que bypassean RLS (export, disparo de jobs, llamadas HTTP):
 *      dispararían efectos sobre el tenant activo desde un simple cambio de cookie.
 *
 * Clasificá cualquier acción nueva por su MECANISMO real (leé el RPC/side-effect), no
 * por su nombre. Si una escritura pasa por RLS app-aware sobre el tenant activo, NO la
 * bloquees acá (la base ya la gatea). Bloqueá solo lo del tipo 1 y 2.
 */
export function assertNotSupportMode(profile: UserProfile): void {
  if (profile.is_support_mode) {
    const err = new Error(
      `Acción no disponible en modo soporte (tenant ${profile.active_tenant.nombre}). Volvé a tu tenant para operar.`,
    ) as Error & { code: string };
    err.code = SUPPORT_MODE_BLOCKED;
    throw err;
  }
}
