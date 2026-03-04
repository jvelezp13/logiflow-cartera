"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import type { AppRole } from "@/lib/auth/types";
import { APP_ID } from "@/lib/auth/types";

// Verificar que el usuario tiene permisos de admin
async function requireAdmin() {
  const profile = await getUserProfile();
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    throw new Error("No autorizado");
  }
  return profile;
}

export async function getUsuarios() {
  const profile = await requireAdmin();
  const supabase = await createClient();

  // JOIN con app_permissions para obtener el role por app
  const query = supabase
    .from("profiles")
    .select("id, tenant_id, full_name, email, is_active, created_at, app_permissions!inner(role)")
    .eq("app_permissions.app_id", APP_ID)
    .order("created_at", { ascending: false });

  // Admin solo ve usuarios de su tenant, super_admin ve todos
  if (profile.role === "admin") {
    query.eq("tenant_id", profile.tenant_id);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Transformar para mantener { role } en el shape esperado
  return (data || []).map((u) => {
    const permissions = u.app_permissions as { role: AppRole }[];
    return {
      id: u.id,
      tenant_id: u.tenant_id,
      full_name: u.full_name,
      email: u.email,
      is_active: u.is_active,
      created_at: u.created_at,
      role: permissions[0].role,
    };
  });
}

export async function createUsuario(formData: FormData) {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const email = formData.get("email") as string;
  const fullName = formData.get("full_name") as string;
  const role = (formData.get("role") as AppRole) || "viewer";
  const tenantId = profile.role === "super_admin"
    ? (formData.get("tenant_id") as string) || profile.tenant_id
    : profile.tenant_id;

  // Crear usuario en auth con metadata para el trigger
  // handle_new_user() crea profile + app_permissions automaticamente
  const { error } = await supabase.auth.admin.createUser({
    email,
    password: formData.get("password") as string,
    email_confirm: true,
    user_metadata: {
      tenant_id: tenantId,
      role,
      full_name: fullName,
      app_id: APP_ID,
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function updateUsuario(userId: string, formData: FormData) {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const fullName = formData.get("full_name");
  const role = formData.get("role");
  const isActive = formData.get("is_active");

  // Actualizar datos de perfil (full_name, is_active)
  const profileUpdates: Record<string, unknown> = {};
  if (fullName) profileUpdates.full_name = fullName;
  if (isActive !== null) profileUpdates.is_active = isActive === "true";

  if (Object.keys(profileUpdates).length > 0) {
    const query = supabase.from("profiles").update(profileUpdates).eq("id", userId);
    if (profile.role === "admin") {
      query.eq("tenant_id", profile.tenant_id);
    }
    const { error } = await query;
    if (error) return { error: error.message };
  }

  // Actualizar role en app_permissions (tabla separada)
  if (role) {
    const permQuery = supabase
      .from("app_permissions")
      .update({ role })
      .eq("profile_id", userId)
      .eq("app_id", APP_ID);
    if (profile.role === "admin") {
      permQuery.eq("tenant_id", profile.tenant_id);
    }
    const { error } = await permQuery;
    if (error) return { error: error.message };
  }

  return { success: true };
}

export async function deactivateUsuario(userId: string) {
  const profile = await requireAdmin();
  const supabase = await createClient();

  const query = supabase
    .from("profiles")
    .update({ is_active: false })
    .eq("id", userId);

  if (profile.role === "admin") {
    query.eq("tenant_id", profile.tenant_id);
  }

  const { error } = await query;
  if (error) return { error: error.message };

  return { success: true };
}
