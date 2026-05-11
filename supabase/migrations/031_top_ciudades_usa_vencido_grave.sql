-- ============================================
-- Alinear get_top_ciudades_deuda con la severidad de facturas.
-- Antes: agregaba total_vencido (mora > 0) — incluia facturas "tolerables".
-- Ahora: agrega total_vencido_grave (mora > 5) — solo severidad atencion/critico.
-- Asi el "% Vencido" del dashboard deja de marcar en rojo a ciudades cuyas
-- facturas individuales se ven verdes en clientes/facturas.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_top_ciudades_deuda(
  p_tenant_id uuid,
  p_incluir_castigada boolean DEFAULT false,
  p_limit integer DEFAULT 10
)
RETURNS json
LANGUAGE sql
STABLE
AS $function$
  SELECT COALESCE(json_agg(row_to_json(sub)), '[]'::json)
  FROM (
    SELECT
      ciudad,
      COUNT(DISTINCT codigo_cliente) AS num_clientes,
      SUM(total_deuda) AS total_deuda,
      SUM(total_vencido_grave) AS total_vencido_grave
    FROM vista_cliente_resumen
    WHERE tenant_id = p_tenant_id
      AND ciudad IS NOT NULL
      AND (p_incluir_castigada OR maxima_mora <= 90)
    GROUP BY ciudad
    ORDER BY SUM(total_deuda) DESC
    LIMIT p_limit
  ) sub;
$function$;
