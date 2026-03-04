-- ============================================
-- RLS en profiles
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Super admin puede ver y gestionar todos los perfiles
CREATE POLICY "super_admin_all_profiles" ON public.profiles
  FOR ALL
  USING (public.get_my_role() = 'super_admin');

-- Admin puede ver y gestionar perfiles de su tenant
CREATE POLICY "admin_manage_tenant_profiles" ON public.profiles
  FOR ALL
  USING (
    public.get_my_role() = 'admin'
    AND tenant_id = public.get_my_tenant_id()
  );

-- Viewer solo puede ver su propio perfil
CREATE POLICY "viewer_own_profile" ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

-- ============================================
-- RLS adicional en sync_tenants para sistema de auth
-- (ya tiene policy "service_role_full_access" para service role)
-- ============================================
CREATE POLICY "super_admin_all_tenants" ON public.sync_tenants
  FOR ALL
  USING (public.get_my_role() = 'super_admin');

CREATE POLICY "users_view_own_tenant" ON public.sync_tenants
  FOR SELECT
  USING (id = public.get_my_tenant_id());
