-- ============================================
-- RPC: buscar_pago_ids
-- Búsqueda unificada de pagos por: código cliente, nombre,
-- número de factura, y voucher (text[] array elements).
-- Devuelve pago IDs para filtrar en la query principal.
-- ============================================

CREATE OR REPLACE FUNCTION public.buscar_pago_ids(
  p_tenant_id UUID,
  p_term TEXT
)
RETURNS TABLE(pago_id UUID) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.id
  FROM pagos p
  LEFT JOIN pago_facturas pf ON pf.pago_id = p.id
  LEFT JOIN vista_cliente_resumen vcr
    ON vcr.codigo_cliente = p.codigo_cliente
    AND vcr.tenant_id = p.tenant_id
  WHERE p.tenant_id = p_tenant_id
    AND (
      p.codigo_cliente ILIKE '%' || p_term || '%'
      OR vcr.nombre_negocio ILIKE '%' || p_term || '%'
      OR vcr.razon_social ILIKE '%' || p_term || '%'
      OR pf.no_factura ILIKE '%' || p_term || '%'
      OR EXISTS (
        SELECT 1 FROM unnest(p.vouchers) v WHERE v ILIKE '%' || p_term || '%'
      )
    )
  LIMIT 200;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
