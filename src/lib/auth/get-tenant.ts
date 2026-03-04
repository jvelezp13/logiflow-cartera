import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "./types";

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
 * Lanza error si no hay sesion o perfil.
 */
export async function getUserProfile(): Promise<UserProfile> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    throw new Error("No autenticado");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, tenant_id, role, full_name, email, is_active")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new Error("Perfil no encontrado");
  }

  return profile as UserProfile;
}

/**
 * Obtiene solo el tenant_id del usuario autenticado.
 */
export async function getTenantId(): Promise<string> {
  const profile = await getUserProfile();
  return profile.tenant_id;
}
