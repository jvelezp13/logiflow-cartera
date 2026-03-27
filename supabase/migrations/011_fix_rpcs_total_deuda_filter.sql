-- ============================================
-- Fix: RPCs que consultan vista_cliente_resumen necesitan
-- filtrar por total_deuda > 0 despues de que la migracion 010
-- elimino el WHERE num_facturas > 0 de la vista.
-- ============================================

-- KPIs: solo contar clientes CON deuda
CREATE OR REPLACE FUNCTION get_dashboard_kpis(p_tenant_id UUID, p_incluir_castigada BOOLEAN DEFAULT false)
RETURNS JSON AS $$
  SELECT json_build_object(
    'cartera_total', COALESCE(SUM(total_deuda), 0),
    'cartera_vencida', COALESCE(SUM(total_vencido), 0),
    'cartera_por_vencer', COALESCE(SUM(total_por_vencer), 0),
    'clientes_con_deuda', COUNT(*),
    'facturas_vencidas', (
      SELECT COUNT(*) FROM vista_cartera_enriquecida
      WHERE tenant_id = p_tenant_id AND mora > 0
        AND (p_incluir_castigada OR NOT es_castigada)
    ),
    'facturas_por_vencer', (
      SELECT COUNT(*) FROM vista_cartera_enriquecida
      WHERE tenant_id = p_tenant_id AND mora <= 0
        AND (p_incluir_castigada OR NOT es_castigada)
    )
  )
  FROM vista_cliente_resumen
  WHERE tenant_id = p_tenant_id
    AND total_deuda > 0
    AND (p_incluir_castigada OR maxima_mora <= 90);
$$ LANGUAGE sql STABLE;

-- Ciudades: solo de clientes CON deuda
CREATE OR REPLACE FUNCTION get_ciudades(p_tenant_id UUID)
RETURNS JSON AS $$
  SELECT COALESCE(json_agg(ciudad ORDER BY ciudad), '[]'::json)
  FROM (
    SELECT DISTINCT ciudad
    FROM vista_cliente_resumen
    WHERE tenant_id = p_tenant_id
      AND ciudad IS NOT NULL
      AND total_deuda > 0
  ) sub;
$$ LANGUAGE sql STABLE;

-- Segmentos: solo de clientes CON deuda
CREATE OR REPLACE FUNCTION get_segmentos(p_tenant_id UUID)
RETURNS JSON AS $$
  SELECT COALESCE(json_agg(segmento ORDER BY segmento), '[]'::json)
  FROM (
    SELECT DISTINCT segmento
    FROM vista_cliente_resumen
    WHERE tenant_id = p_tenant_id
      AND segmento IS NOT NULL
      AND total_deuda > 0
  ) sub;
$$ LANGUAGE sql STABLE;
