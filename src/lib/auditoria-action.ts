"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { ensureWriteAccess } from "@/lib/auth/types";
import { revalidatePath } from "next/cache";
import { logError } from "@/lib/logger";

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

  // Intento 1: registrar aprobacion_1 si esta vacia y el usuario no es quien la creo
  const { data: r1, error: e1 } = await supabase
    .from("auditoria_pagos")
    .update({ aprobacion_1: profile.id, aprobacion_1_at: ahora })
    .eq("id", auditoriaId)
    .eq("tenant_id", profile.tenant_id)
    .is("aprobacion_1", null)
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
    .select("created_by, aprobacion_1, aprobacion_2")
    .eq("id", auditoriaId)
    .eq("tenant_id", profile.tenant_id)
    .maybeSingle();

  if (!audit) return { error: "Auditoria no encontrada" };
  if (audit.aprobacion_2) return { error: "Esta auditoria ya fue aprobada por 2 personas" };
  if (audit.created_by === profile.id)
    return { error: "No podes aprobar una auditoria de un pago que vos creaste" };
  if (audit.aprobacion_1 === profile.id) return { error: "Ya aprobaste esta auditoria" };

  return { error: "No se pudo registrar la aprobacion — otro usuario se adelanto" };
}
