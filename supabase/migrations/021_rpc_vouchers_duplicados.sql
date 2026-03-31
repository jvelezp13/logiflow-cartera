-- ============================================
-- RPC: detectar_vouchers_duplicados
-- Dado un tenant y array de vouchers, devuelve pagos
-- que comparten algún voucher (para detección de duplicados
-- y tracking de pagos parciales con mismo soporte).
-- ============================================

CREATE OR REPLACE FUNCTION public.detectar_vouchers_duplicados(
  p_tenant_id UUID,
  p_vouchers TEXT[],
  p_excluir_pago_id UUID DEFAULT NULL
)
RETURNS TABLE(
  pago_id UUID,
  codigo_cliente TEXT,
  fecha_consignacion DATE,
  monto_total NUMERIC,
  vouchers TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.codigo_cliente, p.fecha_consignacion, p.monto_total, p.vouchers
  FROM pagos p
  WHERE p.tenant_id = p_tenant_id
    AND p.vouchers && p_vouchers
    AND (p_excluir_pago_id IS NULL OR p.id != p_excluir_pago_id)
  ORDER BY p.fecha_consignacion DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
