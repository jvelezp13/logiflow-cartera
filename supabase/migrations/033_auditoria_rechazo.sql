-- ============================================
-- Agregar flujo de rechazo a auditoria_pagos.
-- Una alerta puede terminar en dos estados:
--   - Aprobada: aprobacion_2 NOT NULL (flujo de doble aprobacion)
--   - Rechazada: rechazada_por NOT NULL + motivo_cierre + rechazada_at
-- Mutuamente excluyentes. Sin rechazo, las falsas alarmas se acumulan
-- y nadie las cierra — eso mata el sistema de auditoria.
-- ============================================

ALTER TABLE public.auditoria_pagos
  ADD COLUMN rechazada_por UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN rechazada_at TIMESTAMPTZ,
  ADD COLUMN motivo_cierre TEXT;

COMMENT ON COLUMN public.auditoria_pagos.rechazada_por IS
  'Usuario que rechazo la alerta como falso positivo. Mutuamente excluyente con aprobacion_2.';
COMMENT ON COLUMN public.auditoria_pagos.rechazada_at IS
  'Timestamp del rechazo.';
COMMENT ON COLUMN public.auditoria_pagos.motivo_cierre IS
  'Motivo del rechazo (obligatorio cuando rechazada_por IS NOT NULL).';

-- Quien rechaza no puede ser el creador (mismo principio que aprobacion)
ALTER TABLE public.auditoria_pagos
  ADD CONSTRAINT auditoria_pagos_rechazo_distinto_creador
  CHECK (rechazada_por IS DISTINCT FROM created_by);

-- Coherencia de columnas de rechazo: las tres se setean juntas o ninguna.
-- Usa btrim para defender contra escrituras directas a DB que bypassen el trim
-- de la app (ej: motivo = "   " pasaria length > 0 pero no es un motivo real).
ALTER TABLE public.auditoria_pagos
  ADD CONSTRAINT auditoria_pagos_rechazo_coherente
  CHECK (
    (rechazada_por IS NULL AND rechazada_at IS NULL AND motivo_cierre IS NULL)
    OR
    (rechazada_por IS NOT NULL AND rechazada_at IS NOT NULL AND motivo_cierre IS NOT NULL AND btrim(motivo_cierre) <> '')
  );

-- No se puede rechazar una alerta ya aprobada (estados terminales mutuamente excluyentes)
ALTER TABLE public.auditoria_pagos
  ADD CONSTRAINT auditoria_pagos_estados_excluyentes
  CHECK (rechazada_por IS NULL OR aprobacion_2 IS NULL);

-- Index para queries de "pendientes" (chip counts, lista en /alertas) — reemplaza
-- el partial index anterior que solo consideraba aprobacion_2.
DROP INDEX IF EXISTS public.idx_auditoria_pendientes;
CREATE INDEX idx_auditoria_pendientes ON public.auditoria_pagos (tenant_id, created_at DESC)
  WHERE aprobacion_2 IS NULL AND rechazada_por IS NULL;
