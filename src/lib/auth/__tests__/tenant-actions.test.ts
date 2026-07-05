import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted: los mocks se elevan junto a los vi.mock, evitando el TDZ de las const.
const mocks = vi.hoisted(() => {
  const state = { insertResult: { error: null as unknown } };
  return {
    state,
    cookieSet: vi.fn(),
    revalidatePath: vi.fn(),
    getUserProfile: vi.fn(),
    insertSpy: vi.fn(() => Promise.resolve(state.insertResult)),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mocks.revalidatePath(...args),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({ set: mocks.cookieSet }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi
    .fn()
    .mockResolvedValue({ from: () => ({ insert: mocks.insertSpy }) }),
}));
vi.mock("../get-tenant", () => ({
  ACTIVE_TENANT_COOKIE: "cartera_tenant",
  getUserProfile: () => mocks.getUserProfile(),
}));

import { setActiveTenant } from "../tenant-actions";

const HOME = "tenant-1";
const OTHER = "tenant-2";

function profileFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    email: "a@x.com",
    home_tenant_id: HOME,
    is_super_admin: false,
    available_tenants: [{ id: HOME }, { id: OTHER }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.state.insertResult = { error: null };
});

describe("setActiveTenant", () => {
  it("rechaza un tenant fuera de los disponibles (no setea cookie)", async () => {
    mocks.getUserProfile.mockResolvedValue(profileFixture());
    await expect(setActiveTenant("tenant-forzado")).rejects.toThrow(
      "Tenant no disponible",
    );
    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(mocks.insertSpy).not.toHaveBeenCalled();
  });

  it("usuario normal cambia entre grants sin auditar", async () => {
    mocks.getUserProfile.mockResolvedValue(
      profileFixture({ is_super_admin: false }),
    );
    await setActiveTenant(OTHER);
    expect(mocks.insertSpy).not.toHaveBeenCalled();
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "cartera_tenant",
        value: OTHER,
        httpOnly: true,
        sameSite: "lax",
      }),
    );
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });

  it("super_admin al home no audita (no es soporte)", async () => {
    mocks.getUserProfile.mockResolvedValue(
      profileFixture({ is_super_admin: true }),
    );
    await setActiveTenant(HOME);
    expect(mocks.insertSpy).not.toHaveBeenCalled();
    expect(mocks.cookieSet).toHaveBeenCalled();
  });

  it("super_admin a tenant no-home audita el acceso antes de setear la cookie", async () => {
    mocks.getUserProfile.mockResolvedValue(
      profileFixture({ is_super_admin: true }),
    );
    await setActiveTenant(OTHER);
    expect(mocks.insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "cartera.support_tenant_access",
        entity_type: "tenant",
        entity_id: OTHER,
        tenant_id: OTHER,
      }),
    );
    expect(mocks.cookieSet).toHaveBeenCalledWith(
      expect.objectContaining({ value: OTHER }),
    );
  });

  it("fail-closed: si el audit falla, no setea la cookie ni cambia el tenant", async () => {
    mocks.getUserProfile.mockResolvedValue(
      profileFixture({ is_super_admin: true }),
    );
    mocks.state.insertResult = { error: { message: "rls denied" } };
    await expect(setActiveTenant(OTHER)).rejects.toThrow("No se pudo auditar");
    expect(mocks.cookieSet).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
