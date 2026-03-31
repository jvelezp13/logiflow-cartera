-- GIN index para búsqueda de vouchers duplicados (operador && overlap)
CREATE INDEX idx_pagos_vouchers_gin
  ON public.pagos USING GIN (vouchers)
  WHERE array_length(vouchers, 1) > 0;
