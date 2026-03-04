-- Funciones helper para obtener tenant_id y role del usuario autenticado

CREATE OR REPLACE FUNCTION auth.tenant_id()
RETURNS UUID AS $$
  SELECT tenant_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS public.app_role AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- ============================================
-- RLS en tenants
-- ============================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Super admin puede ver y gestionar todos los tenants
CREATE POLICY "super_admin_all_tenants" ON public.tenants
  FOR ALL
  USING (auth.user_role() = 'super_admin');

-- Admin y viewer solo ven su propio tenant
CREATE POLICY "users_view_own_tenant" ON public.tenants
  FOR SELECT
  USING (id = auth.tenant_id());

-- ============================================
-- RLS en profiles
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Super admin puede ver y gestionar todos los perfiles
CREATE POLICY "super_admin_all_profiles" ON public.profiles
  FOR ALL
  USING (auth.user_role() = 'super_admin');

-- Admin puede ver y gestionar perfiles de su tenant
CREATE POLICY "admin_manage_tenant_profiles" ON public.profiles
  FOR ALL
  USING (
    auth.user_role() = 'admin'
    AND tenant_id = auth.tenant_id()
  );

-- Viewer solo puede ver su propio perfil
CREATE POLICY "viewer_own_profile" ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- ============================================
-- RLS en tablas de datos (cartera, pedidos, etc.)
-- Se aplica a las tablas base que alimentan las vistas.
-- Ajustar nombres de tabla segun la BD existente.
-- ============================================

-- Ejemplo generico para cualquier tabla con tenant_id:
-- ALTER TABLE public.cartera ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "tenant_isolation_cartera" ON public.cartera
--   FOR ALL
--   USING (tenant_id = auth.tenant_id());

-- Nota: las vistas heredan las politicas de las tablas base.
-- Si las tablas base tienen RLS con tenant_id, las vistas
-- automaticamente filtraran por tenant.
