import { createClient } from "@/lib/supabase/server";
import { getTenantId } from "@/lib/auth/get-tenant";

// --- Tipos ---

export const TIPOS_NOTA = ["gestion", "compromiso", "novedad"] as const;
export type TipoNota = (typeof TIPOS_NOTA)[number];

export interface NotaCliente {
  id: string;
  tipo: TipoNota;
  contenido: string;
  created_at: string | null;
  created_by_name: string | null;
}

// --- Queries ---

/**
 * Set de codigos de clientes que tienen al menos una nota.
 * Query ligera (solo codigos, sin contenido) para indicador en listas.
 */
export async function getClientesConNotas(
  codigosClientes: string[],
): Promise<Set<string>> {
  if (codigosClientes.length === 0) return new Set();

  const tenantId = await getTenantId();
  const supabase = await createClient();

  const { data } = await supabase
    .from("notas_cliente")
    .select("codigo_cliente")
    .eq("tenant_id", tenantId)
    .in("codigo_cliente", codigosClientes);

  return new Set((data || []).map((r) => r.codigo_cliente));
}


export async function getNotasCliente(
  codigoCliente: string,
): Promise<NotaCliente[]> {
  const tenantId = await getTenantId();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("notas_cliente")
    .select("id, tipo, contenido, created_at, profiles!created_by(full_name)")
    .eq("tenant_id", tenantId)
    .eq("codigo_cliente", codigoCliente)
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) throw error;

  return (data || []).map((row) => {
    const profiles = row.profiles as
      | { full_name: string | null }[]
      | { full_name: string | null }
      | null;
    const profile = Array.isArray(profiles) ? profiles[0] : profiles;

    return {
      id: row.id,
      tipo: row.tipo as TipoNota,
      contenido: row.contenido,
      created_at: row.created_at,
      created_by_name: profile?.full_name ?? null,
    };
  });
}
