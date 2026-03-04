"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/auth/get-tenant";

// Solo super_admin puede gestionar tenants
async function requireSuperAdmin() {
  const profile = await getUserProfile();
  if (profile.role !== "super_admin") {
    throw new Error("No autorizado");
  }
  return profile;
}

export async function getTenants() {
  await requireSuperAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("sync_tenants")
    .select("id, nombre, activo, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createTenant(formData: FormData) {
  await requireSuperAdmin();
  const supabase = await createClient();

  const name = formData.get("name") as string;
  if (!name) return { error: "El nombre es requerido" };

  // Generar slug a partir del nombre
  const slug = name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const { error } = await supabase.from("sync_tenants").insert({ nombre: name, slug });

  if (error) return { error: error.message };
  return { success: true };
}

export async function toggleTenantActive(tenantId: string, isActive: boolean) {
  await requireSuperAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("sync_tenants")
    .update({ activo: isActive })
    .eq("id", tenantId);

  if (error) return { error: error.message };
  return { success: true };
}
