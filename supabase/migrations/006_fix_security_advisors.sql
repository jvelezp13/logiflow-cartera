-- ============================================
-- Fix 1: Vistas SECURITY DEFINER -> INVOKER
-- Las vistas deben respetar RLS del usuario que consulta
-- ============================================
ALTER VIEW public.vista_cartera_enriquecida SET (security_invoker = on);
ALTER VIEW public.vista_cliente_resumen SET (security_invoker = on);
ALTER VIEW public.vista_pedidos_enriquecida SET (security_invoker = on);

-- ============================================
-- Fix 2: Eliminar policies permisivas service_role_full_access
-- service_role YA bypasea RLS automaticamente en Supabase,
-- estas policies con USING(true) permitian acceso a CUALQUIER rol
-- ============================================
DROP POLICY "service_role_full_access" ON public.sync_credentials;
DROP POLICY "service_role_full_access" ON public.sync_runs;
DROP POLICY "service_role_full_access" ON public.sync_tenants;

-- ============================================
-- Fix 3: Agregar policies correctas para sync_credentials y sync_runs
-- Solo super_admin puede ver via API
-- (service_role sigue bypaseando RLS para operaciones de sync)
-- ============================================
CREATE POLICY "super_admin_all_credentials" ON public.sync_credentials
  FOR ALL USING (public.get_my_role() = 'super_admin');

CREATE POLICY "super_admin_all_runs" ON public.sync_runs
  FOR ALL USING (public.get_my_role() = 'super_admin');
