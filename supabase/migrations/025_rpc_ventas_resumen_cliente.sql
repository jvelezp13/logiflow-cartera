-- ============================================
-- RPC: Resumen de ventas por cliente (ultimos N meses)
-- Agrega venta_producto_cliente por codigo_cliente + mes.
-- Tabla poblada por Sync-Logiflow, misma DB compartida.
-- ============================================
CREATE OR REPLACE FUNCTION get_ventas_resumen_cliente(
  p_tenant_id UUID,
  p_meses INTEGER DEFAULT 3,
  p_codigo_cliente TEXT DEFAULT NULL
)
RETURNS TABLE (
  codigo_cliente TEXT,
  mes TEXT,
  venta_total NUMERIC
)
LANGUAGE sql STABLE
AS $$
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
  ORDER BY vpc.codigo_cliente, vpc.mes;
$$;
