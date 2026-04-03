-- ============================================
-- Tabla de auditoria con doble aprobacion para pagos
-- Patron: una anomalia genera un registro; dos aprobadores distintos
-- (ninguno puede ser el creador) lo validan antes de procesar.
-- ============================================

CREATE TABLE public.auditoria_pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.sync_tenants(id) ON DELETE RESTRICT,
  pago_id UUID NOT NULL REFERENCES public.pagos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  datos JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  aprobacion_1 UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  aprobacion_1_at TIMESTAMPTZ,
  aprobacion_2 UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  aprobacion_2_at TIMESTAMPTZ,

  -- Tipo valido segun catalogo de anomalias
  CHECK (tipo IN ('voucher_compartido', 'monto_diff_sync', 'monto_editado', 'monto_diff_ia', 'pago_sin_soporte')),

  -- Ningun aprobador puede ser el mismo usuario que creo el registro
  CHECK (aprobacion_1 IS DISTINCT FROM created_by),
  CHECK (aprobacion_2 IS DISTINCT FROM created_by),

  -- Segunda aprobacion requiere primera (orden obligatorio)
  CHECK (aprobacion_2 IS NULL OR aprobacion_1 IS NOT NULL),

  -- Los dos aprobadores deben ser distintos entre si
  CHECK (aprobacion_1 IS DISTINCT FROM aprobacion_2 OR aprobacion_2 IS NULL)
);

COMMENT ON TABLE public.auditoria_pagos IS 'Registro de anomalias en pagos que requieren doble aprobacion antes de ser procesadas.';
COMMENT ON COLUMN public.auditoria_pagos.tipo IS 'Tipo de anomalia: voucher_compartido, monto_diff_sync, monto_editado, monto_diff_ia, pago_sin_soporte';
COMMENT ON COLUMN public.auditoria_pagos.descripcion IS 'Descripcion legible de la anomalia detectada, para mostrar en la UI.';
COMMENT ON COLUMN public.auditoria_pagos.datos IS 'Contexto adicional de la anomalia en formato JSON (montos, urls, diferencias, etc.)';
COMMENT ON COLUMN public.auditoria_pagos.created_by IS 'Usuario o proceso que genero el registro de auditoria.';
COMMENT ON COLUMN public.auditoria_pagos.aprobacion_1 IS 'Primer aprobador (distinto de created_by). Requerido antes de aprobacion_2.';
COMMENT ON COLUMN public.auditoria_pagos.aprobacion_1_at IS 'Timestamp de la primera aprobacion.';
COMMENT ON COLUMN public.auditoria_pagos.aprobacion_2 IS 'Segundo aprobador (distinto de created_by y de aprobacion_1). Completa el ciclo de doble aprobacion.';
COMMENT ON COLUMN public.auditoria_pagos.aprobacion_2_at IS 'Timestamp de la segunda aprobacion.';

-- ============================================
-- Indexes
-- ============================================

-- Buscar todos los registros de auditoria de un pago
CREATE INDEX idx_auditoria_pago ON public.auditoria_pagos (pago_id);

-- Registros pendientes de completar el ciclo de doble aprobacion, ordenados por fecha
CREATE INDEX idx_auditoria_pendientes ON public.auditoria_pagos (tenant_id, created_at DESC)
  WHERE aprobacion_2 IS NULL;

-- ============================================
-- RLS (mismo patron que pagos en migracion 012)
-- ============================================

ALTER TABLE public.auditoria_pagos ENABLE ROW LEVEL SECURITY;

-- Super admin: acceso total
CREATE POLICY "super_admin_all_auditoria" ON public.auditoria_pagos
  FOR ALL USING (public.get_my_role() = 'super_admin');

-- Admin: acceso total dentro de su tenant
CREATE POLICY "admin_manage_tenant_auditoria" ON public.auditoria_pagos
  FOR ALL USING (
    public.get_my_role() = 'admin'
    AND tenant_id = public.get_my_tenant_id()
  );

-- Viewer: solo lectura dentro de su tenant
CREATE POLICY "viewer_read_tenant_auditoria" ON public.auditoria_pagos
  FOR SELECT USING (
    public.get_my_role() = 'viewer'
    AND tenant_id = public.get_my_tenant_id()
  );
