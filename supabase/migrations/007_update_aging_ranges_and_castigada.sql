-- ============================================
-- Nuevos rangos de envejecimiento + flag es_castigada
-- Rangos: Al dia, 1-5, 6-10, 11-15, 16-20, 21-30, 31-60, 61-90, 90+ (castigada)
-- ============================================

-- 1. Recrear vista con nuevos rangos
CREATE OR REPLACE VIEW public.vista_cartera_enriquecida AS
SELECT c.id,
    c.tenant_id,
    c.codigo_cliente,
    c.no_factura,
    c.fecha_factura,
    c.fecha_vencimiento,
    c.vendedor,
    c.plazo,
    c.cupo,
    c.mora,
    c.total,
    c.fecha_descarga AS cartera_fecha_descarga,
    c.periodo AS cartera_periodo,
    m.razon_social,
    m.nombre_negocio,
    m.nombre_completo,
    m.ciudad,
    m.departamento,
    m.barrio,
    m.direccion,
    m.telefono,
    m.correo,
    m.segmento,
    m.tipologia,
    m.canal,
    m.subcanal,
    CASE
        WHEN c.mora > 90 THEN 'CASTIGADA'
        WHEN c.mora > 60 THEN 'MUY_VENCIDO'
        WHEN c.mora > 30 THEN 'VENCIDO'
        WHEN c.mora > 20 THEN 'VENCIDO_RECIENTE'
        WHEN c.mora > 0 THEN 'VENCIDO_RECIENTE'
        ELSE 'AL_DIA'
    END AS estado_factura,
    CASE
        WHEN c.mora <= 0 THEN 'Al dia'
        WHEN c.mora <= 5 THEN '1-5 dias'
        WHEN c.mora <= 10 THEN '6-10 dias'
        WHEN c.mora <= 15 THEN '11-15 dias'
        WHEN c.mora <= 20 THEN '16-20 dias'
        WHEN c.mora <= 30 THEN '21-30 dias'
        WHEN c.mora <= 60 THEN '31-60 dias'
        WHEN c.mora <= 90 THEN '61-90 dias'
        ELSE '90+ dias'
    END AS rango_mora,
    (c.mora > 90) AS es_castigada
FROM cartera c
LEFT JOIN maestra_total m ON m.codigo_eom = c.codigo_cliente AND m.tenant_id = c.tenant_id;

ALTER VIEW public.vista_cartera_enriquecida SET (security_invoker = on);

-- 2. get_envejecimiento con parametro castigada
CREATE OR REPLACE FUNCTION get_envejecimiento(
  p_tenant_id UUID,
  p_incluir_castigada BOOLEAN DEFAULT false
)
RETURNS JSON AS $$
  WITH datos_filtrados AS (
    SELECT * FROM vista_cartera_enriquecida
    WHERE tenant_id = p_tenant_id
      AND (p_incluir_castigada OR NOT es_castigada)
  ),
  total_general AS (
    SELECT COALESCE(SUM(total), 0) AS total FROM datos_filtrados
  ),
  rangos AS (
    SELECT
      rango_mora AS label,
      COALESCE(SUM(total), 0) AS total,
      COUNT(*) AS cantidad_facturas
    FROM datos_filtrados
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
      CASE r.label
        WHEN 'Al dia' THEN 1
        WHEN '1-5 dias' THEN 2
        WHEN '6-10 dias' THEN 3
        WHEN '11-15 dias' THEN 4
        WHEN '16-20 dias' THEN 5
        WHEN '21-30 dias' THEN 6
        WHEN '31-60 dias' THEN 7
        WHEN '61-90 dias' THEN 8
        WHEN '90+ dias' THEN 9
        ELSE 10
      END
  )
  FROM rangos r, total_general tg;
$$ LANGUAGE sql STABLE;

-- 3. get_dashboard_kpis con parametro castigada
CREATE OR REPLACE FUNCTION get_dashboard_kpis(
  p_tenant_id UUID,
  p_incluir_castigada BOOLEAN DEFAULT false
)
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
    )
  )
  FROM vista_cliente_resumen
  WHERE tenant_id = p_tenant_id
    AND (p_incluir_castigada OR maxima_mora <= 90);
$$ LANGUAGE sql STABLE;

-- 4. get_alertas_completas con parametro castigada
CREATE OR REPLACE FUNCTION get_alertas_completas(
  p_tenant_id UUID,
  p_incluir_castigada BOOLEAN DEFAULT false
)
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
      AND (p_incluir_castigada OR maxima_mora <= 90)
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
        ELSE 'Cerca del cupo de credito'
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
      (CURRENT_DATE - ultimo_pedido_fecha::date)::text || ' dias sin pedidos pero con deuda activa' AS descripcion,
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
      AND (p_incluir_castigada OR maxima_mora <= 90)
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
