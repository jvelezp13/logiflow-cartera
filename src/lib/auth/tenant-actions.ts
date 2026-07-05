"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_TENANT_COOKIE, getUserProfile } from "./get-tenant";
import { APP_ID } from "./types";

/**
 * Registra en iam_audit_log el acceso cross-tenant de un super_admin (modo soporte).
 * Se ejecuta en la transicion deliberada, no en el render: entrar a modo soporte
 * siempre pasa por setActiveTenant (la cookie de tenant solo se escribe aca), asi que
 * la transicion ES el evento de acceso. Fail-closed: si el audit falla, el llamador
 * aborta el cambio de tenant (no hay acceso cross-tenant sin rastro).
 *
 * La policy de iam_audit_log es actor-scoped (WITH CHECK actor_id = auth.uid()), por eso
 * actor_id sale del profile del usuario autenticado, no de un input.
 */
async function auditSupportTenantAccess({
  actorId,
  actorEmail,
  homeTenantId,
  activeTenantId,
}: {
  actorId: string;
  actorEmail: string | null;
  homeTenantId: string;
  activeTenantId: string;
}) {
  const supabase = await createClient();

  const { error } = await supabase.from("iam_audit_log").insert({
    actor_id: actorId,
    actor_email: actorEmail,
    action: "cartera.support_tenant_access",
    entity_type: "tenant",
    entity_id: activeTenantId,
    tenant_id: activeTenantId,
    metadata: {
      app_id: APP_ID,
      home_tenant_id: homeTenantId,
      selected_tenant_id: activeTenantId,
    },
  });

  if (error) {
    throw new Error(`No se pudo auditar el acceso cross-tenant: ${error.message}`);
  }
}

/**
 * Cambia el tenant activo del usuario.
 * Valida SIEMPRE server-side que el tenant este dentro de los disponibles antes de
 * setear la cookie; nunca confia en el input crudo. Si el cambio lleva a un super_admin
 * a un tenant distinto al home (modo soporte), audita ANTES de commitear (fail-closed).
 * El reset de query params tenant-scoped lo hace el cliente via router.replace(pathname).
 */
export async function setActiveTenant(tenantId: string) {
  const profile = await getUserProfile();
  const isAllowedTenant = profile.available_tenants.some(
    (tenant) => tenant.id === tenantId,
  );

  if (!isAllowedTenant) {
    throw new Error("Tenant no disponible para este usuario");
  }

  // Acceso cross-tenant deliberado de un super_admin -> auditar antes de commitear.
  const isSupportSwitch =
    profile.is_super_admin && tenantId !== profile.home_tenant_id;
  if (isSupportSwitch) {
    await auditSupportTenantAccess({
      actorId: profile.id,
      actorEmail: profile.email,
      homeTenantId: profile.home_tenant_id,
      activeTenantId: tenantId,
    });
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: ACTIVE_TENANT_COOKIE,
    value: tenantId,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  // Invalida todo el arbol server (todas las queries dependen del tenant activo)
  // para que se re-ejecuten con el nuevo tenant.
  revalidatePath("/", "layout");
}
