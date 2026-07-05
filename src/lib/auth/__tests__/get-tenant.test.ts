import { describe, it, expect, vi, beforeEach } from "vitest";

// Estado mutable de la cookie de tenant activo (lo setea cada test).
let activeTenantCookie: string | undefined;

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: (name: string) =>
      name === "cartera_tenant" && activeTenantCookie !== undefined
        ? { value: activeTenantCookie }
        : undefined,
    getAll: () => [],
    set: vi.fn(),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

// react cache() passthrough para poder re-invocar getUserProfile entre tests.
vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return { ...actual, cache: (fn: unknown) => fn };
});

import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "../get-tenant";

const mockCreateClient = vi.mocked(createClient);

interface MockConfig {
  user: { id: string } | null;
  profile: Record<string, unknown> | null;
  permissions: Array<{ tenant_id: string; role: string }>;
  tenants: Array<{ id: string; nombre: string; slug: string | null }>;
  auditInsert?: ReturnType<typeof vi.fn>;
}

// Builder chainable: soporta .select().eq().eq().single(), await directo,
// .in().order(), y .insert(). Cada tabla resuelve su data configurada.
function makeSupabaseMock(config: MockConfig) {
  const auditInsert =
    config.auditInsert ?? vi.fn().mockResolvedValue({ error: null });

  function tableBuilder(table: string) {
    const listResult =
      table === "app_permissions"
        ? { data: config.permissions, error: null }
        : table === "sync_tenants"
          ? { data: config.tenants, error: null }
          : { data: null, error: null };

    const builder: Record<string, unknown> = {
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      order: () => builder,
      single: () =>
        Promise.resolve(
          table === "profiles"
            ? {
                data: config.profile,
                error: config.profile ? null : { message: "no profile" },
              }
            : { data: null, error: null },
        ),
      insert: (payload: unknown) =>
        (auditInsert as (p: unknown) => unknown)(payload),
      // Thenable: permite await directo del builder (app_permissions, sync_tenants).
      then: (resolve: (value: unknown) => unknown) => resolve(listResult),
    };
    return builder;
  }

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: config.user },
        error: config.user ? null : { message: "no user" },
      }),
    },
    from: (table: string) => tableBuilder(table),
  };
}

const HOME = "tenant-1";
const OTHER = "tenant-2";

beforeEach(() => {
  vi.clearAllMocks();
  activeTenantCookie = undefined;
});

describe("getUserProfile (multi-tenant)", () => {
  it("usuario no autenticado -> NOT_AUTHENTICATED", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({
        user: null,
        profile: null,
        permissions: [],
        tenants: [],
      }) as never,
    );
    await expect(getUserProfile()).rejects.toMatchObject({
      code: "NOT_AUTHENTICATED",
    });
  });

  it("autenticado sin profile -> NO_ACCESS", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({
        user: { id: "u1" },
        profile: null,
        permissions: [],
        tenants: [],
      }) as never,
    );
    await expect(getUserProfile()).rejects.toMatchObject({ code: "NO_ACCESS" });
  });

  it("permisos vacios -> NO_ACCESS", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({
        user: { id: "u1" },
        profile: {
          id: "u1",
          tenant_id: HOME,
          full_name: "Ana",
          email: "a@x.com",
          is_active: true,
        },
        permissions: [],
        tenants: [],
      }) as never,
    );
    await expect(getUserProfile()).rejects.toMatchObject({ code: "NO_ACCESS" });
  });

  it("cuenta desactivada -> ACCOUNT_DISABLED", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({
        user: { id: "u1" },
        profile: {
          id: "u1",
          tenant_id: HOME,
          full_name: "Ana",
          email: "a@x.com",
          is_active: false,
        },
        permissions: [{ tenant_id: HOME, role: "admin" }],
        tenants: [{ id: HOME, nombre: "Nexo", slug: "nexo" }],
      }) as never,
    );
    await expect(getUserProfile()).rejects.toMatchObject({
      code: "ACCOUNT_DISABLED",
    });
  });

  it("sin cookie usa home tenant si esta disponible", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({
        user: { id: "u1" },
        profile: {
          id: "u1",
          tenant_id: HOME,
          full_name: "Ana",
          email: "a@x.com",
          is_active: true,
        },
        permissions: [
          { tenant_id: HOME, role: "admin" },
          { tenant_id: OTHER, role: "viewer" },
        ],
        tenants: [
          { id: HOME, nombre: "Nexo", slug: "nexo" },
          { id: OTHER, nombre: "Medina", slug: "medina" },
        ],
      }) as never,
    );
    const profile = await getUserProfile();
    expect(profile.tenant_id).toBe(HOME);
    expect(profile.home_tenant_id).toBe(HOME);
    expect(profile.role).toBe("admin");
    expect(profile.is_support_mode).toBe(false);
    expect(profile.available_tenants).toHaveLength(2);
  });

  it("cookie valida selecciona tenant activo y role correlacionado", async () => {
    activeTenantCookie = OTHER;
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({
        user: { id: "u1" },
        profile: {
          id: "u1",
          tenant_id: HOME,
          full_name: "Ana",
          email: "a@x.com",
          is_active: true,
        },
        permissions: [
          { tenant_id: HOME, role: "admin" },
          { tenant_id: OTHER, role: "viewer" },
        ],
        tenants: [
          { id: HOME, nombre: "Nexo", slug: "nexo" },
          { id: OTHER, nombre: "Medina", slug: "medina" },
        ],
      }) as never,
    );
    const profile = await getUserProfile();
    expect(profile.tenant_id).toBe(OTHER);
    expect(profile.role).toBe("viewer");
    expect(profile.active_tenant.nombre).toBe("Medina");
    // admin en su home no es super_admin -> cambiar de tenant NO es modo soporte.
    expect(profile.is_support_mode).toBe(false);
  });

  it("cookie invalida cae al home tenant", async () => {
    activeTenantCookie = "tenant-inexistente";
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({
        user: { id: "u1" },
        profile: {
          id: "u1",
          tenant_id: HOME,
          full_name: "Ana",
          email: "a@x.com",
          is_active: true,
        },
        permissions: [{ tenant_id: HOME, role: "admin" }],
        tenants: [{ id: HOME, nombre: "Nexo", slug: "nexo" }],
      }) as never,
    );
    const profile = await getUserProfile();
    expect(profile.tenant_id).toBe(HOME);
    expect(profile.role).toBe("admin");
  });

  it("usuario normal excluye grants cuyo tenant no esta activo/disponible", async () => {
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({
        user: { id: "u1" },
        profile: {
          id: "u1",
          tenant_id: HOME,
          full_name: "Ana",
          email: "a@x.com",
          is_active: true,
        },
        permissions: [
          { tenant_id: HOME, role: "admin" },
          { tenant_id: "tenant-inactivo", role: "viewer" },
        ],
        // sync_tenants solo devuelve el activo (simula el filtro .in + activo=true).
        tenants: [{ id: HOME, nombre: "Nexo", slug: "nexo" }],
      }) as never,
    );
    const profile = await getUserProfile();
    expect(profile.available_tenants).toHaveLength(1);
    expect(profile.available_tenants[0].id).toBe(HOME);
  });

  it("super_admin usa tenant sin grant propio -> modo soporte, sin escribir audit en el read", async () => {
    activeTenantCookie = OTHER;
    const auditInsert = vi.fn().mockResolvedValue({ error: null });
    mockCreateClient.mockResolvedValue(
      makeSupabaseMock({
        user: { id: "u1" },
        profile: {
          id: "u1",
          tenant_id: HOME,
          full_name: "Ana",
          email: "a@x.com",
          is_active: true,
        },
        permissions: [{ tenant_id: HOME, role: "super_admin" }],
        tenants: [
          { id: HOME, nombre: "Nexo", slug: "nexo" },
          { id: OTHER, nombre: "Medina", slug: "medina" },
        ],
        auditInsert,
      }) as never,
    );
    const profile = await getUserProfile();
    expect(profile.tenant_id).toBe(OTHER);
    expect(profile.role).toBe("super_admin");
    expect(profile.is_super_admin).toBe(true);
    expect(profile.is_support_mode).toBe(true);
    // getUserProfile es lectura pura: NO audita (la auditoria vive en setActiveTenant).
    expect(auditInsert).not.toHaveBeenCalled();
  });
});
