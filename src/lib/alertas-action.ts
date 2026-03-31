"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { revalidatePath } from "next/cache";
import { logError } from "@/lib/logger";

export async function marcarAlertaLeida(
  alertaId: string
): Promise<{ success: boolean; error?: string }> {
  const profile = await getUserProfile();
  const supabase = await createClient();

  const { error } = await supabase
    .from("sync_alertas")
    .update({ leida: true })
    .eq("id", alertaId)
    .eq("tenant_id", profile.tenant_id);

  if (error) {
    logError("marcarAlertaLeida", error);
    return { success: false, error: "Error al marcar alerta" };
  }

  revalidatePath("/alertas");
  return { success: true };
}

export async function marcarTodasLeidas(): Promise<{ success: boolean; count?: number; error?: string }> {
  const profile = await getUserProfile();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sync_alertas")
    .update({ leida: true })
    .eq("tenant_id", profile.tenant_id)
    .eq("leida", false)
    .select("id");

  if (error) {
    logError("marcarTodasLeidas", error);
    return { success: false, error: "Error al marcar alertas" };
  }

  revalidatePath("/alertas");
  return { success: true, count: data?.length || 0 };
}
