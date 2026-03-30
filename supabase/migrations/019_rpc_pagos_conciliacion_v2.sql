-- ============================================
-- RPCs de conciliacion de pagos v2 (Capa 3 auditoria)
-- Detecta 3 estados por pago verificado:
--   conciliado    — la factura ya no existe en cartera O su saldo disminuyo
--                   en el monto esperado (tolerancia $1.000)
--   sin_conciliar — el saldo de la factura no disminuyo nada
--                   (cartera.total >= pf.valor_factura)
--   discrepancia  — el saldo bajo, pero por un monto diferente al esperado
--                   (diferencia > $1.000 vs el abono registrado)
-- Reemplaza get_pagos_sin_conciliar y get_pago_ids_sin_conciliar.
-- ============================================

DROP FUNCTION IF EXISTS get_pagos_sin_conciliar(UUID);
DROP FUNCTION IF EXISTS get_pago_ids_sin_conciliar(UUID);

-- ---------------------------------------------------------------------------
-- get_pagos_conciliacion
-- Devuelve en UNA sola llamada los conteos de pagos sin_conciliar y con discrepancia.
-- Mas eficiente que hacer dos RPCs separadas.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_pagos_conciliacion(p_tenant_id UUID)
RETURNS TABLE(sin_conciliar BIGINT, con_discrepancia BIGINT) AS $$
WITH conciliacion AS (
  SELECT
    p.id AS pago_id,
    pf.valor_factura,
    pf.valor_aplicado,
    c.total AS saldo_actual,
    CASE
      WHEN c.total IS NULL                                                          THEN 'conciliado'
      WHEN c.total >= pf.valor_factura                                              THEN 'sin_conciliar'
      WHEN ABS(c.total - (pf.valor_factura - pf.valor_aplicado)) > 1000            THEN 'discrepancia'
      ELSE 'conciliado'
    END AS estado
  FROM pagos p
  JOIN pago_facturas pf
    ON  pf.pago_id = p.id
  LEFT JOIN cartera c
    ON  c.no_factura     = pf.no_factura
    AND c.tenant_id      = p.tenant_id
    AND c.codigo_cliente = p.codigo_cliente
  WHERE p.tenant_id          = p_tenant_id
    AND p.estado             = 'verificado'
    AND pf.valor_factura IS NOT NULL
    AND pf.valor_factura     > 0
)
SELECT
  COUNT(DISTINCT pago_id) FILTER (WHERE estado = 'sin_conciliar')  AS sin_conciliar,
  COUNT(DISTINCT pago_id) FILTER (WHERE estado = 'discrepancia')   AS con_discrepancia
FROM conciliacion;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_pagos_conciliacion(UUID) IS
  'Devuelve en una sola llamada los conteos de pagos verificados sin_conciliar y con discrepancia para un tenant. '
  'sin_conciliar: la factura no disminuyo nada de saldo. '
  'discrepancia: la factura bajo de saldo pero por un monto diferente al esperado (tolerancia $1.000).';

-- ---------------------------------------------------------------------------
-- get_pago_ids_conciliacion
-- Devuelve los IDs de pagos en un estado de conciliacion especifico.
-- p_estado acepta: ''sin_conciliar'' | ''discrepancia'' | ''conciliado''
-- Un solo RPC parametrizado reemplaza get_pago_ids_sin_conciliar.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_pago_ids_conciliacion(p_tenant_id UUID, p_estado TEXT)
RETURNS SETOF UUID AS $$
WITH conciliacion AS (
  SELECT
    p.id AS pago_id,
    pf.valor_factura,
    pf.valor_aplicado,
    c.total AS saldo_actual,
    CASE
      WHEN c.total IS NULL                                                          THEN 'conciliado'
      WHEN c.total >= pf.valor_factura                                              THEN 'sin_conciliar'
      WHEN ABS(c.total - (pf.valor_factura - pf.valor_aplicado)) > 1000            THEN 'discrepancia'
      ELSE 'conciliado'
    END AS estado
  FROM pagos p
  JOIN pago_facturas pf
    ON  pf.pago_id = p.id
  LEFT JOIN cartera c
    ON  c.no_factura     = pf.no_factura
    AND c.tenant_id      = p.tenant_id
    AND c.codigo_cliente = p.codigo_cliente
  WHERE p.tenant_id          = p_tenant_id
    AND p.estado             = 'verificado'
    AND pf.valor_factura IS NOT NULL
    AND pf.valor_factura     > 0
)
SELECT DISTINCT pago_id FROM conciliacion WHERE estado = p_estado;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_pago_ids_conciliacion(UUID, TEXT) IS
  'Devuelve los IDs de pagos verificados para un estado de conciliacion dado (sin_conciliar | discrepancia | conciliado). '
  'Companion parametrizado de get_pagos_conciliacion para filtrar la lista paginada de /pagos.';
