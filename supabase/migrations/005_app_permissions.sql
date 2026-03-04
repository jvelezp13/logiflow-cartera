-- ============================================
-- Migracion: Sistema de permisos por app
-- Mueve el role de profiles a app_permissions
-- ============================================

-- 1. Crear tabla app_permissions
CREATE TABLE public.app_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.sync_tenants(id) ON DELETE RESTRICT,
  app_id TEXT NOT NULL,
  role public.app_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_profile_app_tenant UNIQUE (profile_id, app_id, tenant_id)
);

CREATE INDEX idx_app_perm_profile ON public.app_permissions(profile_id);
CREATE INDEX idx_app_perm_app_tenant ON public.app_permissions(app_id, tenant_id);

CREATE TRIGGER on_app_permissions_updated
  BEFORE UPDATE ON public.app_permissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. Migrar datos existentes (defensivo)
INSERT INTO public.app_permissions (profile_id, tenant_id, app_id, role)
SELECT id, tenant_id, 'cartera', role FROM public.profiles WHERE role IS NOT NULL;

INSERT INTO public.app_permissions (profile_id, tenant_id, app_id, role)
SELECT id, tenant_id, 'sync-panel', role FROM public.profiles WHERE role IS NOT NULL;

-- 3. Actualizar get_my_role() - retorna rol MAS ALTO del usuario
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS public.app_role AS $$
  SELECT role FROM public.app_permissions
  WHERE profile_id = auth.uid()
  ORDER BY CASE role
    WHEN 'super_admin' THEN 0
    WHEN 'admin' THEN 1
    WHEN 'viewer' THEN 2
  END
  LIMIT 1
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '';

-- 4. Actualizar handle_new_user() - crea profile + permiso
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_tenant_id UUID;
  v_app_id TEXT;
  v_role public.app_role;
BEGIN
  v_tenant_id := (NEW.raw_user_meta_data->>'tenant_id')::UUID;
  v_app_id := COALESCE(NEW.raw_user_meta_data->>'app_id', 'cartera');
  v_role := COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'viewer');

  INSERT INTO public.profiles (id, tenant_id, full_name, email)
  VALUES (NEW.id, v_tenant_id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);

  INSERT INTO public.app_permissions (profile_id, tenant_id, app_id, role)
  VALUES (NEW.id, v_tenant_id, v_app_id, v_role);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 5. Quitar columna role de profiles
DROP INDEX IF EXISTS idx_profiles_role;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;

-- 6. RLS en app_permissions
ALTER TABLE public.app_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "super_admin_all_permissions" ON public.app_permissions
  FOR ALL USING (public.get_my_role() = 'super_admin');

CREATE POLICY "admin_manage_tenant_permissions" ON public.app_permissions
  FOR ALL USING (
    public.get_my_role() = 'admin'
    AND tenant_id = public.get_my_tenant_id()
  );

CREATE POLICY "user_view_own_permissions" ON public.app_permissions
  FOR SELECT USING (profile_id = auth.uid());

-- 7. Seed del usuario existente
INSERT INTO public.profiles (id, tenant_id, full_name, email)
VALUES ('a9fada48-b10f-46d2-add5-e455f8ed0bfe', '0bd44961-e36a-4fc1-8fbd-6577b09e6139',
  'Julian Velez', 'jvelez.nexo@gmail.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.app_permissions (profile_id, tenant_id, app_id, role) VALUES
  ('a9fada48-b10f-46d2-add5-e455f8ed0bfe', '0bd44961-e36a-4fc1-8fbd-6577b09e6139', 'cartera', 'super_admin'),
  ('a9fada48-b10f-46d2-add5-e455f8ed0bfe', '0bd44961-e36a-4fc1-8fbd-6577b09e6139', 'sync-panel', 'super_admin')
ON CONFLICT ON CONSTRAINT uq_profile_app_tenant DO NOTHING;
