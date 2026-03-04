import { createClient } from "@/lib/supabase/server";
import { cache } from "react";
import type { AppRole } from "./types";
import { APP_ID } from "./types";

export interface UserProfile {
  id: string;
  tenant_id: string;
  role: AppRole;
  full_name: string | null;
  email: string | null;
  is_active: boolean;
}

/**
 * Obtiene el perfil completo del usuario autenticado.
 * Cacheado con React cache() -- se ejecuta 1 sola vez por request.
 */
export const getUserProfile = cache(async function getUserProfile(): Promise<UserProfile> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("No autenticado");
  }

  // INNER JOIN: si no tiene permiso para esta app, retorna null
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, tenant_id, full_name, email, is_active, app_permissions!inner(role)")
    .eq("id", user.id)
    .eq("app_permissions.app_id", APP_ID)
    .single();

  if (profileError || !profile) {
    throw new Error("Sin acceso a esta aplicacion");
  }

  // Extraer role del array de permisos
  const permissions = profile.app_permissions as { role: AppRole }[];
  return {
    id: profile.id,
    tenant_id: profile.tenant_id,
    full_name: profile.full_name,
    email: profile.email,
    is_active: profile.is_active,
    role: permissions[0].role,
  };
});

/**
 * Obtiene solo el tenant_id del usuario autenticado.
 */
export async function getTenantId(): Promise<string> {
  const profile = await getUserProfile();
  return profile.tenant_id;
}
