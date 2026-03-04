"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import type { AppRole } from "@/lib/auth/types";

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

  const query = supabase
    .from("profiles")
    .select("id, tenant_id, role, full_name, email, is_active, created_at")
    .order("created_at", { ascending: false });

  // Admin solo ve usuarios de su tenant, super_admin ve todos
  if (profile.role === "admin") {
    query.eq("tenant_id", profile.tenant_id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
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
  const { error } = await supabase.auth.admin.createUser({
    email,
    password: formData.get("password") as string,
    email_confirm: true,
    user_metadata: {
      tenant_id: tenantId,
      role,
      full_name: fullName,
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

  const updates: Record<string, unknown> = {};
  const fullName = formData.get("full_name");
  const role = formData.get("role");
  const isActive = formData.get("is_active");

  if (fullName) updates.full_name = fullName;
  if (role) updates.role = role;
  if (isActive !== null) updates.is_active = isActive === "true";

  const query = supabase.from("profiles").update(updates).eq("id", userId);

  // Admin solo puede editar usuarios de su tenant
  if (profile.role === "admin") {
    query.eq("tenant_id", profile.tenant_id);
  }

  const { error } = await query;
  if (error) return { error: error.message };

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
