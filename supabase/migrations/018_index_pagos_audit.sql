-- Índices parciales para filtros de auditoría sobre ai_extraction JSONB.
-- Sin estos, las queries de capsulas hacen seq scan sobre toda la tabla.

CREATE INDEX idx_pagos_audit_monto_modificado
  ON public.pagos (tenant_id)
  WHERE (ai_extraction -> '_audit' ->> 'monto_modificado') = 'true';

CREATE INDEX idx_pagos_audit_manual
  ON public.pagos (tenant_id)
  WHERE (ai_extraction -> '_audit' ->> 'data_origin') = 'manual';
