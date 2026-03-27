-- ============================================
-- Tabla de notas/observaciones por cliente
-- Timeline acumulativa de gestion de cobro
-- ============================================

CREATE TABLE public.notas_cliente (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.sync_tenants(id) ON DELETE RESTRICT,
  codigo_cliente TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'novedad'
    CHECK (tipo IN ('gestion', 'compromiso', 'novedad')),
  contenido TEXT NOT NULL CHECK (char_length(contenido) > 0),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.notas_cliente IS 'Bitacora de gestion de cobro por cliente. Append-only timeline.';
COMMENT ON COLUMN public.notas_cliente.tipo IS 'gestion=contacto/seguimiento, compromiso=acuerdo/pago, novedad=evento/contexto';
COMMENT ON COLUMN public.notas_cliente.created_at IS 'NULL indica nota importada desde historico (sin fecha conocida)';

-- Indice principal: notas de un cliente ordenadas por fecha, historicas al final
CREATE INDEX idx_notas_cliente_lookup
  ON public.notas_cliente (tenant_id, codigo_cliente, created_at DESC NULLS LAST);

-- Indice para consultas por autor
CREATE INDEX idx_notas_cliente_created_by
  ON public.notas_cliente (created_by);

-- Trigger updated_at (reutiliza funcion existente de migracion 001)
CREATE TRIGGER on_notas_cliente_updated
  BEFORE UPDATE ON public.notas_cliente
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- RLS (mismo patron que profiles en migracion 003)
-- ============================================

ALTER TABLE public.notas_cliente ENABLE ROW LEVEL SECURITY;

-- Super admin: acceso total
CREATE POLICY "super_admin_all_notas" ON public.notas_cliente
  FOR ALL
  USING (public.get_my_role() = 'super_admin');

-- Admin: acceso total dentro de su tenant
CREATE POLICY "admin_manage_tenant_notas" ON public.notas_cliente
  FOR ALL
  USING (
    public.get_my_role() = 'admin'
    AND tenant_id = public.get_my_tenant_id()
  );

-- Viewer: solo lectura dentro de su tenant
CREATE POLICY "viewer_read_tenant_notas" ON public.notas_cliente
  FOR SELECT
  USING (
    public.get_my_role() = 'viewer'
    AND tenant_id = public.get_my_tenant_id()
  );
