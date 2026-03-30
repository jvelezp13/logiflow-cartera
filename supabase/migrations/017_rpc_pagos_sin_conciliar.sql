-- ============================================
-- RPCs de conciliacion de pagos (Capa 3 auditoria)
-- Un pago verificado queda "sin conciliar" cuando la factura vinculada
-- sigue teniendo el mismo saldo en cartera (el CRM no proceso el pago aun).
-- ============================================

-- Devuelve el COUNT de pagos verificados sin conciliar para un tenant.
-- Usado por el KPI/capsule de auditoria en /pagos.
CREATE OR REPLACE FUNCTION get_pagos_sin_conciliar(p_tenant_id UUID)
RETURNS BIGINT AS $$
  SELECT COUNT(DISTINCT p.id)
  FROM pagos p
  JOIN pago_facturas pf ON pf.pago_id = p.id
  LEFT JOIN cartera c
    ON  c.no_factura     = pf.no_factura
    AND c.tenant_id      = p.tenant_id
    AND c.codigo_cliente = p.codigo_cliente
  WHERE p.tenant_id  = p_tenant_id
    AND p.estado     = 'verificado'
    AND pf.valor_factura IS NOT NULL
    AND pf.valor_factura > 0
    AND c.total IS NOT NULL
    AND c.total >= pf.valor_factura
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_pagos_sin_conciliar(UUID) IS
  'Cuenta pagos verificados cuyas facturas vinculadas no han disminuido de saldo en cartera. Indica que el CRM no proceso el pago todavia.';

-- Devuelve los IDs de pagos verificados sin conciliar para un tenant.
-- Usado para filtrar la lista paginada de /pagos con filtro=sin_conciliar.
CREATE OR REPLACE FUNCTION get_pago_ids_sin_conciliar(p_tenant_id UUID)
RETURNS SETOF UUID AS $$
  SELECT DISTINCT p.id
  FROM pagos p
  JOIN pago_facturas pf ON pf.pago_id = p.id
  LEFT JOIN cartera c
    ON  c.no_factura     = pf.no_factura
    AND c.tenant_id      = p.tenant_id
    AND c.codigo_cliente = p.codigo_cliente
  WHERE p.tenant_id  = p_tenant_id
    AND p.estado     = 'verificado'
    AND pf.valor_factura IS NOT NULL
    AND pf.valor_factura > 0
    AND c.total IS NOT NULL
    AND c.total >= pf.valor_factura
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_pago_ids_sin_conciliar(UUID) IS
  'Devuelve IDs de pagos verificados sin conciliar. Companion de get_pagos_sin_conciliar para filtrar la lista paginada.';
