-- ============================================
-- Tabla: pagos_historial
-- Audit log de cambios en pagos. Cada fila es
-- un campo modificado con valor anterior y nuevo.
-- ============================================

CREATE TABLE public.pagos_historial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pago_id UUID NOT NULL REFERENCES public.pagos(id) ON DELETE CASCADE,
  campo TEXT NOT NULL,
  valor_anterior TEXT,
  valor_nuevo TEXT,
  modificado_por UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_pagos_historial_pago ON public.pagos_historial (pago_id);

ALTER TABLE public.pagos_historial ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_pagos_historial" ON public.pagos_historial
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.pagos p
      WHERE p.id = pago_id
        AND public.get_my_role() = 'super_admin'
    )
  );

CREATE POLICY "admin_manage_tenant_pagos_historial" ON public.pagos_historial
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.pagos p
      WHERE p.id = pago_id
        AND public.get_my_role() = 'admin'
        AND p.tenant_id = public.get_my_tenant_id()
    )
  );

CREATE POLICY "viewer_read_tenant_pagos_historial" ON public.pagos_historial
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.pagos p
      WHERE p.id = pago_id
        AND public.get_my_role() = 'viewer'
        AND p.tenant_id = public.get_my_tenant_id()
    )
  );

CREATE POLICY "service_role_bypass_pagos_historial" ON public.pagos_historial
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
