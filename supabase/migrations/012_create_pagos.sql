-- ============================================
-- Tablas de registro de pagos y soportes
-- Modelo relacional: pagos (1) -> pago_facturas (N)
-- ============================================

CREATE TABLE public.pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.sync_tenants(id) ON DELETE RESTRICT,
  codigo_cliente TEXT NOT NULL,
  fecha_consignacion DATE NOT NULL,
  monto_total NUMERIC NOT NULL CHECK (monto_total > 0),
  medio_pago TEXT,
  vouchers TEXT[] DEFAULT '{}',
  numero_recaudo INTEGER,
  numero_recibo INTEGER,
  observaciones TEXT,
  nota_credito TEXT,
  valor_nota_credito NUMERIC,
  soporte_url TEXT,
  soporte_key TEXT,
  soporte_nombre TEXT,
  estado TEXT NOT NULL DEFAULT 'registrado'
    CHECK (estado IN ('registrado', 'verificado')),
  ai_extraction JSONB,
  importado_historico BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.pagos IS 'Registro de pagos de clientes con soporte adjunto y extraccion IA.';
COMMENT ON COLUMN public.pagos.estado IS 'registrado=sin codigos CRM, verificado=con recaudo y recibo completos';
COMMENT ON COLUMN public.pagos.ai_extraction IS 'JSON crudo de la extraccion IA del soporte, para auditoria';
COMMENT ON COLUMN public.pagos.soporte_key IS 'Object key en Cloudflare R2 (para generar presigned URLs)';
COMMENT ON COLUMN public.pagos.importado_historico IS 'true si viene del import del Excel historico';

CREATE TABLE public.pago_facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pago_id UUID NOT NULL REFERENCES public.pagos(id) ON DELETE CASCADE,
  no_factura TEXT NOT NULL,
  valor_factura NUMERIC,
  valor_aplicado NUMERIC NOT NULL CHECK (valor_aplicado > 0)
);

COMMENT ON TABLE public.pago_facturas IS 'Junction: facturas cubiertas por un pago. Un pago puede cubrir N facturas.';

-- ============================================
-- Indexes
-- ============================================

-- Pagos de un cliente ordenados por fecha
CREATE INDEX idx_pagos_cliente_lookup
  ON public.pagos (tenant_id, codigo_cliente, fecha_consignacion DESC);

-- Lista paginada de pagos por tenant
CREATE INDEX idx_pagos_tenant_fecha
  ON public.pagos (tenant_id, fecha_consignacion DESC);

-- Pagos pendientes de codigos CRM (partial index)
CREATE INDEX idx_pagos_sin_crm
  ON public.pagos (tenant_id, created_at DESC)
  WHERE numero_recaudo IS NULL OR numero_recibo IS NULL;

-- Idempotencia para import historico
CREATE UNIQUE INDEX idx_pagos_recaudo_unique
  ON public.pagos (tenant_id, numero_recaudo)
  WHERE numero_recaudo IS NOT NULL;

-- Buscar facturas por pago
CREATE INDEX idx_pago_facturas_pago
  ON public.pago_facturas (pago_id);

-- Buscar si una factura tiene pagos
CREATE INDEX idx_pago_facturas_factura
  ON public.pago_facturas (no_factura);

-- ============================================
-- Trigger updated_at (reutiliza funcion existente de migracion 001)
-- ============================================

CREATE TRIGGER on_pagos_updated
  BEFORE UPDATE ON public.pagos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- RLS (mismo patron que notas_cliente en migracion 009)
-- ============================================

ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

-- Super admin: acceso total
CREATE POLICY "super_admin_all_pagos" ON public.pagos
  FOR ALL
  USING (public.get_my_role() = 'super_admin');

-- Admin: acceso total dentro de su tenant
CREATE POLICY "admin_manage_tenant_pagos" ON public.pagos
  FOR ALL
  USING (
    public.get_my_role() = 'admin'
    AND tenant_id = public.get_my_tenant_id()
  );

-- Viewer: solo lectura dentro de su tenant
CREATE POLICY "viewer_read_tenant_pagos" ON public.pagos
  FOR SELECT
  USING (
    public.get_my_role() = 'viewer'
    AND tenant_id = public.get_my_tenant_id()
  );

-- pago_facturas hereda seguridad via JOIN a pagos
ALTER TABLE public.pago_facturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_pago_facturas" ON public.pago_facturas
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.pagos p
      WHERE p.id = pago_id
        AND public.get_my_role() = 'super_admin'
    )
  );

CREATE POLICY "admin_manage_tenant_pago_facturas" ON public.pago_facturas
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.pagos p
      WHERE p.id = pago_id
        AND public.get_my_role() = 'admin'
        AND p.tenant_id = public.get_my_tenant_id()
    )
  );

CREATE POLICY "viewer_read_tenant_pago_facturas" ON public.pago_facturas
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pagos p
      WHERE p.id = pago_id
        AND public.get_my_role() = 'viewer'
        AND p.tenant_id = public.get_my_tenant_id()
    )
  );
