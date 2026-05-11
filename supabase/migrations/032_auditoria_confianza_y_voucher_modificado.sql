-- ============================================
-- Ampliar auditoria_pagos con dos tipos nuevos: confianza_baja y voucher_modificado.
-- Antes eran "chips" en /pagos sobre propiedades crudas del JSON ai_extraction,
-- sin flujo de cierre. Ahora pasan a ser alertas auditables con doble aprobacion.
--
-- Incluye backfill idempotente para pagos existentes que cumplan las condiciones,
-- usando UPSERT por (pago_id, tipo). Para datos retroactivos se usa pagos.created_by
-- como created_by de la auditoria (mas fiel historicamente). Pagos sin created_by
-- (raros) se saltean.
-- ============================================

-- 1. Ampliar el CHECK constraint para aceptar los tipos nuevos
ALTER TABLE public.auditoria_pagos
  DROP CONSTRAINT IF EXISTS auditoria_pagos_tipo_check;

ALTER TABLE public.auditoria_pagos
  ADD CONSTRAINT auditoria_pagos_tipo_check
  CHECK (tipo IN (
    'voucher_compartido',
    'monto_diff_sync',
    'monto_editado',
    'monto_diff_ia',
    'pago_sin_soporte',
    'confianza_baja',
    'voucher_modificado'
  ));

COMMENT ON COLUMN public.auditoria_pagos.tipo IS
  'Tipo de anomalia: voucher_compartido, monto_diff_sync, monto_editado, monto_diff_ia, pago_sin_soporte, confianza_baja, voucher_modificado';

-- 2. Backfill: pagos con confianza baja extraida por IA
INSERT INTO public.auditoria_pagos (tenant_id, pago_id, tipo, descripcion, datos, created_by)
SELECT
  p.tenant_id,
  p.id,
  'confianza_baja',
  'IA extrajo el pago con confianza baja — cliente ' || p.codigo_cliente,
  jsonb_build_object(
    'confianza_nivel', p.ai_extraction->'confianza'->>'nivel',
    'confianza_notas', p.ai_extraction->'confianza'->>'notas'
  ),
  p.created_by
FROM public.pagos p
WHERE p.ai_extraction->'confianza'->>'nivel' = 'bajo'
  AND p.created_by IS NOT NULL
ON CONFLICT (pago_id, tipo) DO NOTHING;

-- 3. Backfill: pagos donde el usuario cambio el voucher vs lo extraido por IA
INSERT INTO public.auditoria_pagos (tenant_id, pago_id, tipo, descripcion, datos, created_by)
SELECT
  p.tenant_id,
  p.id,
  'voucher_modificado',
  'Voucher modificado vs extraccion IA — cliente ' || p.codigo_cliente,
  jsonb_build_object(
    'voucher_ia', p.ai_extraction->'_audit'->>'voucher_ia',
    'voucher_usuario', p.ai_extraction->'_audit'->>'voucher_usuario'
  ),
  p.created_by
FROM public.pagos p
WHERE p.ai_extraction->'_audit'->>'voucher_modificado' = 'true'
  AND p.created_by IS NOT NULL
ON CONFLICT (pago_id, tipo) DO NOTHING;
