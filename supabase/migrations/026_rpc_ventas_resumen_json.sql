-- ============================================
-- Fix: Cambiar RPC a RETURNS JSON para evitar
-- truncamiento de PostgREST (limite 1000 filas
-- con RETURNS TABLE). Patron consistente con
-- las demas RPCs del proyecto.
-- ============================================
DROP FUNCTION IF EXISTS get_ventas_resumen_cliente(UUID, INTEGER, TEXT);

CREATE OR REPLACE FUNCTION get_ventas_resumen_cliente(
  p_tenant_id UUID,
  p_meses INTEGER DEFAULT 3,
  p_codigo_cliente TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(json_agg(row_data), '[]'::json)
  FROM (
    SELECT
      vpc.codigo_cliente,
      vpc.mes,
      SUM(vpc.venta_neta) AS venta_total
    FROM venta_producto_cliente vpc
    WHERE vpc.tenant_id = p_tenant_id
      AND vpc.mes >= to_char(
        current_date - (p_meses * INTERVAL '1 month'),
        'YYYY-MM'
      )
      AND (p_codigo_cliente IS NULL OR vpc.codigo_cliente = p_codigo_cliente)
    GROUP BY vpc.codigo_cliente, vpc.mes
    ORDER BY vpc.codigo_cliente, vpc.mes
  ) row_data;
$$;
