"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/auth/get-tenant";
import { revalidatePath } from "next/cache";
import { TIPOS_NOTA } from "@/lib/queries/notas-server";
import { logError } from "@/lib/logger";

export interface NotaActionState {
  error?: string;
  success?: boolean;
}

export async function crearNota(
  _prevState: NotaActionState | null,
  formData: FormData,
): Promise<NotaActionState> {
  const profile = await getUserProfile();

  if (profile.role === "viewer") {
    return { error: "No tienes permiso para crear notas" };
  }

  const codigoCliente = formData.get("codigo_cliente") as string;
  const tipo = formData.get("tipo") as string;
  const contenido = (formData.get("contenido") as string)?.trim();

  if (!codigoCliente) {
    return { error: "Cliente invalido" };
  }

  if (!contenido) {
    return { error: "El contenido es requerido" };
  }

  if (contenido.length > 2000) {
    return { error: "La nota no puede exceder 2000 caracteres" };
  }

  if (!TIPOS_NOTA.includes(tipo as (typeof TIPOS_NOTA)[number])) {
    return { error: "Tipo de nota invalido" };
  }

  const supabase = await createClient();

  const { error } = await supabase.from("notas_cliente").insert({
    tenant_id: profile.tenant_id,
    codigo_cliente: codigoCliente,
    tipo,
    contenido,
    created_by: profile.id,
  });

  if (error) {
    logError("crearNota", error);
    return { error: "Error al guardar la nota" };
  }

  revalidatePath(`/clientes/${codigoCliente}`);
  return { success: true };
}
