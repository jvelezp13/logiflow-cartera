import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock de Supabase
const mockSignIn = vi.fn();
const mockSignOut = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      signInWithPassword: (...args: unknown[]) => mockSignIn(...args),
      signOut: (...args: unknown[]) => mockSignOut(...args),
    },
  }),
}));

// Mock de next/navigation
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// Mock de next/headers (necesario para el server client)
vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    getAll: () => [],
    set: vi.fn(),
  }),
}));

describe("login action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna error si falta email", async () => {
    const { login } = await import("../actions");

    const formData = new FormData();
    formData.set("email", "");
    formData.set("password", "test");

    const result = await login(null, formData);
    expect(result).toEqual({ error: "Email y contraseña son requeridos" });
  });

  it("retorna error si falta password", async () => {
    const { login } = await import("../actions");

    const formData = new FormData();
    formData.set("email", "test@test.com");
    formData.set("password", "");

    const result = await login(null, formData);
    expect(result).toEqual({ error: "Email y contraseña son requeridos" });
  });

  it("retorna error si credenciales incorrectas", async () => {
    mockSignIn.mockResolvedValue({ error: { message: "Invalid credentials" } });

    const { login } = await import("../actions");

    const formData = new FormData();
    formData.set("email", "test@test.com");
    formData.set("password", "wrongpass");

    const result = await login(null, formData);
    expect(result).toEqual({ error: "Credenciales incorrectas" });
  });

  it("llama a signInWithPassword con email y password", async () => {
    mockSignIn.mockResolvedValue({ error: null });

    const { login } = await import("../actions");

    const formData = new FormData();
    formData.set("email", "test@test.com");
    formData.set("password", "correctpass");

    try {
      await login(null, formData);
    } catch {
      // redirect lanza un error en tests
    }

    expect(mockSignIn).toHaveBeenCalledWith({
      email: "test@test.com",
      password: "correctpass",
    });
  });
});
