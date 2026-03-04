-- ============================================
-- RPC: KPIs del dashboard
-- Calcula SUM/COUNT directamente en SQL
-- ============================================
CREATE OR REPLACE FUNCTION get_dashboard_kpis(p_tenant_id UUID)
RETURNS JSON AS $$
  SELECT json_build_object(
    'cartera_total', COALESCE(SUM(total_deuda), 0),
    'cartera_vencida', COALESCE(SUM(total_vencido), 0),
    'cartera_por_vencer', COALESCE(SUM(total_por_vencer), 0),
    'clientes_con_deuda', COUNT(*),
    'facturas_vencidas', (
      SELECT COUNT(*) FROM vista_cartera_enriquecida
      WHERE tenant_id = p_tenant_id AND mora > 0
    ),
    'facturas_por_vencer', (
      SELECT COUNT(*) FROM vista_cartera_enriquecida
      WHERE tenant_id = p_tenant_id AND mora <= 0
    )
  )
  FROM vista_cliente_resumen
  WHERE tenant_id = p_tenant_id;
$$ LANGUAGE sql STABLE;

-- ============================================
-- RPC: Envejecimiento agrupado por rango
-- ============================================
CREATE OR REPLACE FUNCTION get_envejecimiento(p_tenant_id UUID)
RETURNS JSON AS $$
  WITH total_general AS (
    SELECT COALESCE(SUM(total), 0) AS total
    FROM vista_cartera_enriquecida
    WHERE tenant_id = p_tenant_id
  ),
  rangos AS (
    SELECT
      CASE rango_mora
        WHEN '0' THEN 'Al día'
        ELSE rango_mora || ' días'
      END AS label,
      rango_mora AS rango_key,
      COALESCE(SUM(total), 0) AS total,
      COUNT(*) AS cantidad_facturas
    FROM vista_cartera_enriquecida
    WHERE tenant_id = p_tenant_id
    GROUP BY rango_mora
  )
  SELECT json_agg(
    json_build_object(
      'label', r.label,
      'total', r.total,
      'cantidad_facturas', r.cantidad_facturas,
      'porcentaje', CASE WHEN tg.total > 0 THEN (r.total / tg.total) * 100 ELSE 0 END
    )
    ORDER BY
      CASE r.rango_key
        WHEN '0' THEN 1
        WHEN '1-30' THEN 2
        WHEN '31-60' THEN 3
        WHEN '61-90' THEN 4
        WHEN '90+' THEN 5
        ELSE 6
      END
  )
  FROM rangos r, total_general tg;
$$ LANGUAGE sql STABLE;

-- ============================================
-- RPC: Ciudades distintas
-- ============================================
CREATE OR REPLACE FUNCTION get_ciudades(p_tenant_id UUID)
RETURNS JSON AS $$
  SELECT COALESCE(json_agg(ciudad ORDER BY ciudad), '[]'::json)
  FROM (
    SELECT DISTINCT ciudad
    FROM vista_cliente_resumen
    WHERE tenant_id = p_tenant_id AND ciudad IS NOT NULL
  ) sub;
$$ LANGUAGE sql STABLE;

-- ============================================
-- RPC: Segmentos distintos
-- ============================================
CREATE OR REPLACE FUNCTION get_segmentos(p_tenant_id UUID)
RETURNS JSON AS $$
  SELECT COALESCE(json_agg(segmento ORDER BY segmento), '[]'::json)
  FROM (
    SELECT DISTINCT segmento
    FROM vista_cliente_resumen
    WHERE tenant_id = p_tenant_id AND segmento IS NOT NULL
  ) sub;
$$ LANGUAGE sql STABLE;

-- ============================================
-- RPC: Alertas completas (consolida 4 queries en 1)
-- ============================================
CREATE OR REPLACE FUNCTION get_alertas_completas(p_tenant_id UUID)
RETURNS JSON AS $$
  WITH pedidos_con_deuda AS (
    SELECT
      'PEDIDOS_PENDIENTES' AS tipo,
      'alta' AS severidad,
      'Pedido pendiente con deuda vencida' AS titulo,
      'Cliente con pedido #' || p.num_pedido || ' sin descargar y con facturas vencidas' AS descripcion,
      p.codigo_cliente,
      p.pedido_cliente_nombre AS razon_social,
      p.pedido_ciudad AS ciudad,
      p.pedido_total::numeric AS valor,
      NULL::integer AS dias_mora,
      NULL::numeric AS porcentaje_utilizado,
      NULL::integer AS dias_sin_pedido
    FROM vista_pedidos_enriquecida p
    WHERE p.tenant_id = p_tenant_id
      AND p.estado = 'Sin Descargar'
      AND p.fecha >= (CURRENT_DATE - INTERVAL '3 days')
      AND COALESCE(p.facturas_vencidas_cliente, 0) > 0
  ),
  deuda_vencida AS (
    SELECT
      'DEUDA_VENCIDA' AS tipo,
      CASE WHEN total_vencido > 3000000 THEN 'critica' ELSE 'alta' END AS severidad,
      'Deuda vencida significativa' AS titulo,
      'Cliente con $' || total_vencido::bigint::text || ' en deuda vencida' AS descripcion,
      codigo_cliente,
      razon_social,
      ciudad,
      total_vencido::numeric AS valor,
      maxima_mora::integer AS dias_mora,
      NULL::numeric AS porcentaje_utilizado,
      NULL::integer AS dias_sin_pedido
    FROM vista_cliente_resumen
    WHERE tenant_id = p_tenant_id
      AND total_vencido > 1000000
    ORDER BY total_vencido DESC
    LIMIT 20
  ),
  cupo_excedido AS (
    SELECT
      'CUPO_EXCEDIDO' AS tipo,
      CASE
        WHEN (total_deuda::numeric / cupo_asignado::numeric) * 100 > 95 THEN 'critica'
        WHEN (total_deuda::numeric / cupo_asignado::numeric) * 100 > 90 THEN 'alta'
        ELSE 'media'
      END AS severidad,
      CASE
        WHEN (total_deuda::numeric / cupo_asignado::numeric) * 100 > 100 THEN 'Cupo excedido'
        ELSE 'Cerca del cupo de crédito'
      END AS titulo,
      'Cliente usando ' || ROUND((total_deuda::numeric / cupo_asignado::numeric) * 100, 1)::text || '% del cupo' AS descripcion,
      codigo_cliente,
      razon_social,
      ciudad,
      total_deuda::numeric AS valor,
      NULL::integer AS dias_mora,
      ROUND((total_deuda::numeric / cupo_asignado::numeric) * 100, 1) AS porcentaje_utilizado,
      NULL::integer AS dias_sin_pedido
    FROM vista_cliente_resumen
    WHERE tenant_id = p_tenant_id
      AND estado_credito = 'Activo'
      AND cupo_asignado IS NOT NULL
      AND cupo_asignado > 0
      AND (total_deuda::numeric / cupo_asignado::numeric) * 100 > 80
  ),
  inactivos AS (
    SELECT
      'CLIENTE_INACTIVO' AS tipo,
      'media' AS severidad,
      'Cliente inactivo con deuda' AS titulo,
      (CURRENT_DATE - ultimo_pedido_fecha::date)::text || ' días sin pedidos pero con deuda activa' AS descripcion,
      codigo_cliente,
      razon_social,
      ciudad,
      total_deuda::numeric AS valor,
      NULL::integer AS dias_mora,
      NULL::numeric AS porcentaje_utilizado,
      (CURRENT_DATE - ultimo_pedido_fecha::date)::integer AS dias_sin_pedido
    FROM vista_cliente_resumen
    WHERE tenant_id = p_tenant_id
      AND total_vencido > 0
      AND ultimo_pedido_fecha IS NOT NULL
      AND ultimo_pedido_fecha::date < (CURRENT_DATE - INTERVAL '30 days')
    ORDER BY total_deuda DESC
    LIMIT 20
  ),
  todas AS (
    SELECT * FROM pedidos_con_deuda
    UNION ALL SELECT * FROM deuda_vencida
    UNION ALL SELECT * FROM cupo_excedido
    UNION ALL SELECT * FROM inactivos
  )
  SELECT COALESCE(json_agg(
    json_build_object(
      'tipo', tipo,
      'severidad', severidad,
      'titulo', titulo,
      'descripcion', descripcion,
      'codigo_cliente', codigo_cliente,
      'razon_social', razon_social,
      'ciudad', ciudad,
      'valor', valor,
      'dias_mora', dias_mora,
      'porcentaje_utilizado', porcentaje_utilizado,
      'dias_sin_pedido', dias_sin_pedido
    )
    ORDER BY
      CASE severidad
        WHEN 'critica' THEN 0
        WHEN 'alta' THEN 1
        WHEN 'media' THEN 2
        WHEN 'baja' THEN 3
      END
  ), '[]'::json)
  FROM todas;
$$ LANGUAGE sql STABLE;
