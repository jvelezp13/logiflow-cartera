-- ============================================
-- Agregar columna tipo a pagos para diferenciar pagos de notas credito
-- ============================================

ALTER TABLE public.pagos
  ADD COLUMN tipo TEXT NOT NULL DEFAULT 'pago'
  CHECK (tipo IN ('pago', 'nota_credito'));

COMMENT ON COLUMN public.pagos.tipo IS 'pago=pago normal o retroactivo, nota_credito=descarte de factura con soporte NC';

-- Index parcial para consultar solo notas credito (poco frecuente)
CREATE INDEX idx_pagos_tipo_nc
  ON public.pagos (tenant_id, created_at DESC)
  WHERE tipo = 'nota_credito';
