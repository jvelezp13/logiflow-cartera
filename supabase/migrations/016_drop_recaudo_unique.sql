-- Eliminar constraint de unicidad en numero_recaudo.
-- El CRM permite causar múltiples pagos en una misma transacción,
-- generando el mismo código de recaudo para varios pagos.
DROP INDEX IF EXISTS idx_pagos_recaudo_unique;
