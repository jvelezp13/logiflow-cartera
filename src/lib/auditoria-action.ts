"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { ensureWriteAccess } from "@/lib/auth/types";
import { revalidatePath } from "next/cache";
import { logError } from "@/lib/logger";
import { AUDITORIA_MOTIVO_MAX_LENGTH } from "@/lib/pagos-constants";

export interface AprobacionResult {
  success?: boolean;
  error?: string;
}

/**
 * Server action para aprobar una auditoria de pago.
 * Implementa doble aprobacion: aprobacion_1 primero, luego aprobacion_2.
 * Reglas:
 * - Solo admin/super_admin pueden aprobar
 * - No podes aprobar tu propia auditoria (la que vos creaste)
 * - No podes ser los dos aprobadores (no podes hacer aprobacion_1 y aprobacion_2)
 */
export async function aprobarAuditoria(
  auditoriaId: string
): Promise<AprobacionResult> {
  const profile = await getUserProfile();

  const writeError = ensureWriteAccess(profile.role);
  if (writeError) return { error: writeError };

  const supabase = await createClient();
  const ahora = new Date().toISOString();

  // Intento 1: registrar aprobacion_1 si esta vacia, no rechazada, y el usuario no es quien la creo
  const { data: r1, error: e1 } = await supabase
    .from("auditoria_pagos")
    .update({ aprobacion_1: profile.id, aprobacion_1_at: ahora })
    .eq("id", auditoriaId)
    .eq("tenant_id", profile.tenant_id)
    .is("aprobacion_1", null)
    .is("rechazada_por", null)
    .neq("created_by", profile.id)
    .select("id")
    .maybeSingle();

  if (e1) {
    logError("aprobarAuditoria:update1", e1);
    return { error: "Error al registrar aprobacion" };
  }

  if (r1) {
    revalidatePath("/alertas");
    return { success: true };
  }

  // Intento 2: registrar aprobacion_2 si aprobacion_1 esta set pero aprobacion_2 no,
  // y el usuario no es ni el creador ni el primer aprobador
  const { data: r2, error: e2 } = await supabase
    .from("auditoria_pagos")
    .update({ aprobacion_2: profile.id, aprobacion_2_at: ahora })
    .eq("id", auditoriaId)
    .eq("tenant_id", profile.tenant_id)
    .is("aprobacion_2", null)
    .is("rechazada_por", null)
    .not("aprobacion_1", "is", null)
    .neq("aprobacion_1", profile.id)
    .neq("created_by", profile.id)
    .select("id")
    .maybeSingle();

  if (e2) {
    logError("aprobarAuditoria:update2", e2);
    return { error: "Error al registrar aprobacion" };
  }

  if (r2) {
    revalidatePath("/alertas");
    revalidatePath("/pagos");
    return { success: true };
  }

  // Diagnostico: por que fallaron ambos intentos?
  const { data: audit } = await supabase
    .from("auditoria_pagos")
    .select("created_by, aprobacion_1, aprobacion_2, rechazada_por")
    .eq("id", auditoriaId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!audit) return { error: "Auditoria no encontrada" };
  if (audit.rechazada_por) return { error: "Esta auditoria ya fue rechazada" };
  if (audit.aprobacion_2) return { error: "Esta auditoria ya fue aprobada por 2 personas" };
  if (audit.created_by === profile.id)
    return { error: "No podes aprobar una auditoria de un pago que vos creaste" };
  if (audit.aprobacion_1 === profile.id) return { error: "Ya aprobaste esta auditoria" };

  return { error: "No se pudo registrar la aprobacion — otro usuario se adelanto" };
}

/**
 * Server action para rechazar una auditoria como falso positivo.
 * Reglas:
 * - Solo admin/super_admin pueden rechazar
 * - No podes rechazar tu propia auditoria
 * - No se puede rechazar si ya fue aprobada (aprobacion_2 NOT NULL)
 * - Motivo obligatorio (no vacio, max 200 chars)
 */
export async function rechazarAuditoria(
  auditoriaId: string,
  motivo: string
): Promise<AprobacionResult> {
  const profile = await getUserProfile();

  const writeError = ensureWriteAccess(profile.role);
  if (writeError) return { error: writeError };

  const motivoLimpio = motivo.trim();
  if (motivoLimpio.length === 0) return { error: "El motivo del rechazo es obligatorio" };
  if (motivoLimpio.length > AUDITORIA_MOTIVO_MAX_LENGTH) {
    return { error: `El motivo no puede superar ${AUDITORIA_MOTIVO_MAX_LENGTH} caracteres` };
  }

  const supabase = await createClient();
  const ahora = new Date().toISOString();

  const { data, error } = await supabase
    .from("auditoria_pagos")
    .update({
      rechazada_por: profile.id,
      rechazada_at: ahora,
      motivo_cierre: motivoLimpio,
    })
    .eq("id", auditoriaId)
    .eq("tenant_id", profile.tenant_id)
    .is("rechazada_por", null)
    .is("aprobacion_2", null)
    .neq("created_by", profile.id)
    .select("id")
    .maybeSingle();

  if (error) {
    logError("rechazarAuditoria:update", error);
    return { error: "Error al registrar el rechazo" };
  }

  if (data) {
    revalidatePath("/alertas");
    revalidatePath("/pagos");
    return { success: true };
  }

  const { data: audit } = await supabase
    .from("auditoria_pagos")
    .select("created_by, aprobacion_2, rechazada_por")
    .eq("id", auditoriaId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!audit) return { error: "Auditoria no encontrada" };
  if (audit.aprobacion_2) return { error: "No se puede rechazar una auditoria ya aprobada" };
  if (audit.rechazada_por) return { error: "Esta auditoria ya fue rechazada" };
  if (audit.created_by === profile.id)
    return { error: "No podes rechazar una auditoria de un pago que vos creaste" };

  return { error: "No se pudo registrar el rechazo — otro usuario se adelanto" };
}
