-- ============================================
-- Agregar campos de contacto a vista_cliente_resumen
-- Campos nuevos: documento, telefono, correo, canal, nombre_completo, estado
-- Fuente: maestra_total (ya hace JOIN, solo faltaban en el SELECT)
-- ============================================

-- DROP necesario porque CREATE OR REPLACE no permite reordenar columnas
DROP VIEW IF EXISTS public.vista_cliente_resumen;

CREATE VIEW public.vista_cliente_resumen AS
SELECT
  m.tenant_id,
  m.codigo_ecom AS codigo_cliente,
  m.razon_social,
  m.nombre_negocio,
  m.nombre_completo,
  m.documento,
  m.ciudad,
  m.telefono,
  m.correo,
  m.segmento,
  m.tipologia,
  m.canal,
  m.estado,
  -- Agregados de cartera (facturas)
  COALESCE(f.num_facturas, 0)::integer AS num_facturas,
  COALESCE(f.total_deuda, 0) AS total_deuda,
  COALESCE(f.total_vencido, 0) AS total_vencido,
  COALESCE(f.total_por_vencer, 0) AS total_por_vencer,
  f.primera_vencimiento,
  f.ultima_vencimiento,
  COALESCE(f.maxima_mora, 0)::integer AS maxima_mora,
  COALESCE(f.num_vendedores, 0)::integer AS num_vendedores,
  -- Credito (de clientes_credito)
  cr.cupo AS cupo_asignado,
  cr.estado AS estado_credito,
  -- Pedidos
  COALESCE(p.pedidos_pendientes, 0)::integer AS pedidos_pendientes,
  p.ultimo_pedido_fecha
FROM maestra_total m
LEFT JOIN (
  SELECT
    tenant_id,
    codigo_cliente,
    COUNT(*) AS num_facturas,
    SUM(total) AS total_deuda,
    SUM(CASE WHEN mora > 0 THEN total ELSE 0 END) AS total_vencido,
    SUM(CASE WHEN mora <= 0 THEN total ELSE 0 END) AS total_por_vencer,
    MIN(fecha_vencimiento) AS primera_vencimiento,
    MAX(fecha_vencimiento) AS ultima_vencimiento,
    MAX(mora) AS maxima_mora,
    COUNT(DISTINCT vendedor) AS num_vendedores
  FROM cartera
  GROUP BY tenant_id, codigo_cliente
) f ON f.codigo_cliente = m.codigo_ecom AND f.tenant_id = m.tenant_id
LEFT JOIN (
  SELECT DISTINCT ON (tenant_id, codigo_cliente)
    tenant_id,
    codigo_cliente,
    cupo,
    estado
  FROM clientes_credito
  ORDER BY tenant_id, codigo_cliente, fecha_descarga DESC
) cr ON cr.codigo_cliente = m.codigo_ecom AND cr.tenant_id = m.tenant_id
LEFT JOIN (
  SELECT
    tenant_id,
    codigo_cliente,
    COUNT(*) FILTER (WHERE estado = 'Sin Descargar') AS pedidos_pendientes,
    MAX(fecha) AS ultimo_pedido_fecha
  FROM pedidos
  GROUP BY tenant_id, codigo_cliente
) p ON p.codigo_cliente = m.codigo_ecom AND p.tenant_id = m.tenant_id
-- Solo mostrar clientes que tienen facturas en cartera
WHERE f.num_facturas > 0;

-- Mantener security_invoker para RLS
ALTER VIEW public.vista_cliente_resumen SET (security_invoker = on);
