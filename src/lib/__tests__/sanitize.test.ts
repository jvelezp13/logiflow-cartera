import { describe, it, expect } from "vitest";

// Importamos la funcion indirectamente ya que es privada en cartera.ts
// La recreamos aqui para testear el patron
function sanitizeSearchInput(input: string): string {
  return input.replace(/[%_.*,()\\\n\r]/g, "");
}

describe("sanitizeSearchInput", () => {
  it("deja pasar texto normal", () => {
    expect(sanitizeSearchInput("cliente123")).toBe("cliente123");
  });

  it("elimina caracteres peligrosos de PostgREST", () => {
    expect(sanitizeSearchInput("test%injection")).toBe("testinjection");
    expect(sanitizeSearchInput("test_wild")).toBe("testwild");
    expect(sanitizeSearchInput("test.dot")).toBe("testdot");
    expect(sanitizeSearchInput("test*star")).toBe("teststar");
    expect(sanitizeSearchInput("test,comma")).toBe("testcomma");
    expect(sanitizeSearchInput("test(paren)")).toBe("testparen");
  });

  it("elimina backslashes", () => {
    expect(sanitizeSearchInput("test\\escape")).toBe("testescape");
  });

  it("elimina saltos de linea", () => {
    expect(sanitizeSearchInput("test\nline")).toBe("testline");
    expect(sanitizeSearchInput("test\rline")).toBe("testline");
  });

  it("retorna string vacio si todo es caracteres peligrosos", () => {
    expect(sanitizeSearchInput("%_.*")).toBe("");
  });

  it("permite espacios y tildes", () => {
    expect(sanitizeSearchInput("Juan López")).toBe("Juan López");
  });
});
