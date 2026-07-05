import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { cache } from "react";
import type { AppRole } from "./types";
import { APP_ID } from "./types";

export const ACTIVE_TENANT_COOKIE = "cartera_tenant";

export interface AvailableTenant {
  id: string;
  nombre: string;
  slug: string | null;
  role: AppRole;
  is_home: boolean;
}

export interface UserProfile {
  id: string;
  tenant_id: string;
  home_tenant_id: string;
  role: AppRole;
  full_name: string | null;
  email: string | null;
  is_active: boolean;
  is_super_admin: boolean;
  available_tenants: AvailableTenant[];
  active_tenant: AvailableTenant;
  is_support_mode: boolean;
}

interface ProfileRow {
  id: string;
  tenant_id: string;
  full_name: string | null;
  email: string | null;
  is_active: boolean;
}

interface PermissionRow {
  tenant_id: string;
  role: AppRole;
}

interface TenantRow {
  id: string;
  nombre: string;
  slug: string | null;
}

function createNoAccessError(message = "Sin acceso a esta aplicacion"): Error & {
  code: string;
} {
  const err = new Error(message) as Error & { code: string };
  err.code = "NO_ACCESS";
  return err;
}

function buildTenantNameFallback(tenantId: string): string {
  return `Tenant ${tenantId.slice(0, 8)}`;
}

function resolveAvailableTenants({
  homeTenantId,
  permissions,
  tenants,
  isSuperAdmin,
}: {
  homeTenantId: string;
  permissions: PermissionRow[];
  tenants: TenantRow[];
  isSuperAdmin: boolean;
}): AvailableTenant[] {
  const permissionsByTenant = new Map(
    permissions.map((permission) => [permission.tenant_id, permission.role]),
  );
  const tenantInfoById = new Map(tenants.map((tenant) => [tenant.id, tenant]));
  // super_admin: todos los tenants activos. Usuario normal: solo tenants con grant que ademas este activo.
  const tenantIds = isSuperAdmin
    ? tenants.map((tenant) => tenant.id)
    : permissions
        .map((permission) => permission.tenant_id)
        .filter((tenantId) => tenantInfoById.has(tenantId));

  return Array.from(new Set(tenantIds)).map((tenantId) => {
    const tenant = tenantInfoById.get(tenantId);
    // Rol efectivo del tenant: grant explicito si existe; si no (super_admin sin grant propio), super_admin.
    const role = permissionsByTenant.get(tenantId) ?? "super_admin";

    return {
      id: tenantId,
      nombre: tenant?.nombre ?? buildTenantNameFallback(tenantId),
      slug: tenant?.slug ?? null,
      role,
      is_home: tenantId === homeTenantId,
    };
  });
}

/**
 * Obtiene el perfil completo del usuario autenticado con su tenant activo validado.
 * Cacheado con React cache() -- se ejecuta 1 sola vez por request.
 *
 * Funcion de LECTURA pura: no escribe en la DB. La auditoria del acceso cross-tenant
 * (modo soporte) se registra en la transicion deliberada (ver setActiveTenant en
 * tenant-actions.ts), no en el render, porque entrar a modo soporte siempre pasa por
 * esa accion (la cookie de tenant solo la escribe setActiveTenant).
 *
 * El tenant activo se valida SIEMPRE server-side contra available_tenants: una cookie
 * que apunte a un tenant fuera de los disponibles no da acceso (cae al home). La RLS
 * de la base es la garantia real de aislamiento; esta resolucion es la capa de UX.
 */
export const getUserProfile = cache(async function getUserProfile(): Promise<UserProfile> {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    const err = new Error("No autenticado") as Error & { code: string };
    err.code = "NOT_AUTHENTICATED";
    throw err;
  }

  // profiles y app_permissions dependen solo de user.id y son independientes -> en paralelo.
  const [
    { data: profile, error: profileError },
    { data: permissions, error: permissionsError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, tenant_id, full_name, email, is_active")
      .eq("id", user.id)
      .single(),
    supabase
      .from("app_permissions")
      .select("tenant_id, role")
      .eq("profile_id", user.id)
      .eq("app_id", APP_ID),
  ]);

  if (profileError || !profile) {
    throw createNoAccessError(
      `Sin acceso a esta aplicacion: ${profileError?.message ?? "profile null"}`,
    );
  }

  const typedProfile = profile as ProfileRow;

  if (typedProfile.is_active !== true) {
    const err = new Error("Cuenta desactivada") as Error & { code: string };
    err.code = "ACCOUNT_DISABLED";
    throw err;
  }

  if (permissionsError) {
    throw createNoAccessError(
      `Sin acceso a esta aplicacion: ${permissionsError.message}`,
    );
  }

  const typedPermissions = (permissions ?? []) as PermissionRow[];
  if (typedPermissions.length === 0) {
    throw createNoAccessError("Sin acceso a esta aplicacion: permisos vacios");
  }

  const isSuperAdmin = typedPermissions.some(
    (permission) => permission.role === "super_admin",
  );
  const tenantIdsForLookup = Array.from(
    new Set(typedPermissions.map((permission) => permission.tenant_id)),
  );
  const tenantsQuery = supabase
    .from("sync_tenants")
    .select("id, nombre, slug")
    .eq("activo", true);
  const { data: tenants, error: tenantsError } = isSuperAdmin
    ? await tenantsQuery.order("nombre", { ascending: true })
    : await tenantsQuery
        .in("id", tenantIdsForLookup)
        .order("nombre", { ascending: true });

  if (tenantsError) {
    throw createNoAccessError(
      `No se pudieron resolver tenants disponibles: ${tenantsError.message}`,
    );
  }

  const availableTenants = resolveAvailableTenants({
    homeTenantId: typedProfile.tenant_id,
    permissions: typedPermissions,
    tenants: (tenants ?? []) as TenantRow[],
    isSuperAdmin,
  });

  if (availableTenants.length === 0) {
    throw createNoAccessError("Sin tenants disponibles para esta aplicacion");
  }

  const cookieStore = await cookies();
  const selectedTenantId = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value;
  // Validacion server-side: la cookie solo vale si apunta a un tenant disponible.
  // Cascada de fallback: cookie valida -> home tenant -> primer disponible.
  const activeTenant =
    availableTenants.find((tenant) => tenant.id === selectedTenantId) ??
    availableTenants.find((tenant) => tenant.id === typedProfile.tenant_id) ??
    availableTenants[0];
  const isSupportMode = isSuperAdmin && activeTenant.id !== typedProfile.tenant_id;

  return {
    id: typedProfile.id,
    tenant_id: activeTenant.id,
    home_tenant_id: typedProfile.tenant_id,
    full_name: typedProfile.full_name,
    email: typedProfile.email,
    is_active: typedProfile.is_active,
    is_super_admin: isSuperAdmin,
    role: activeTenant.role,
    available_tenants: availableTenants,
    active_tenant: activeTenant,
    is_support_mode: isSupportMode,
  };
});

/**
 * Obtiene solo el tenant activo validado del usuario autenticado.
 */
export async function getTenantId(): Promise<string> {
  const profile = await getUserProfile();
  return profile.tenant_id;
}
