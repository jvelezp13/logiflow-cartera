-- ============================================
-- Fix 1: created_by NOT NULL en auditoria_pagos
-- Un registro de auditoria siempre debe tener un creador conocido.
-- NULL created_by rompe el CHECK IS DISTINCT FROM (NULL IS DISTINCT FROM NULL = false),
-- permitiendo que cualquier usuario apruebe auditorias sin creador.
--
-- Fix 2: cambiar ON DELETE SET NULL a ON DELETE RESTRICT en la FK de created_by.
-- Si se elimina el profile del creador, la auditoria no debe perder su trazabilidad.
--
-- Fix 3: indice UNIQUE para prevenir eventos de auditoria duplicados por pago+tipo.
-- Protege el patron fire-and-forget en crearPago y editarPago.
-- ============================================

-- Paso 1: backfill de filas con created_by NULL antes de aplicar NOT NULL
-- (en caso de que existan registros previos — seguro en migraciones idempotentes)
UPDATE public.auditoria_pagos
SET created_by = '00000000-0000-0000-0000-000000000000'::uuid
WHERE created_by IS NULL;

-- Paso 2: aplicar NOT NULL
ALTER TABLE public.auditoria_pagos
  ALTER COLUMN created_by SET NOT NULL;

-- Paso 3: cambiar la FK a RESTRICT (no se puede eliminar el profile del creador)
ALTER TABLE public.auditoria_pagos
  DROP CONSTRAINT auditoria_pagos_created_by_fkey;

ALTER TABLE public.auditoria_pagos
  ADD CONSTRAINT auditoria_pagos_created_by_fkey
    FOREIGN KEY (created_by)
    REFERENCES public.profiles(id)
    ON DELETE RESTRICT;

-- Paso 4: indice UNIQUE para prevenir duplicados pago+tipo
CREATE UNIQUE INDEX IF NOT EXISTS idx_auditoria_pago_tipo_unique
  ON public.auditoria_pagos (pago_id, tipo);
