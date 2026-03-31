-- Flag para indicar que un pago fue editado post-creación.
-- Evita subquery a pagos_historial en la tabla principal.
ALTER TABLE public.pagos ADD COLUMN editado BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_pagos_editado
  ON public.pagos (tenant_id)
  WHERE editado = true;
