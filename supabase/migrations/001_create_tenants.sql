-- NOTA: No se crea tabla tenants nueva.
-- Se reutiliza la tabla sync_tenants existente (3 registros, 26 tablas la referencian).
-- Columnas de sync_tenants: id, nombre, slug, activo, created_at, updated_at

-- Funcion helper para updated_at (usada por profiles y otras tablas)
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
