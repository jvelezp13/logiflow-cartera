-- Fix: partial index on pagos was filtering WHERE numero_recaudo IS NULL OR numero_recibo IS NULL,
-- but the query filters by estado = 'registrado'. Align the index to match the actual query pattern.

DROP INDEX IF EXISTS idx_pagos_sin_crm;

CREATE INDEX idx_pagos_sin_crm
  ON public.pagos (tenant_id, estado)
  WHERE estado = 'registrado';
