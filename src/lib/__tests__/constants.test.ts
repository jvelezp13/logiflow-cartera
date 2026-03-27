import { describe, it, expect } from "vitest";
import { RANGE_COLORS, SEVERITY_GRUPOS, SEVERITY_COLORS } from "../constants";

describe("RANGE_COLORS", () => {
  it("tiene 9 colores para los rangos de envejecimiento", () => {
    expect(Object.keys(RANGE_COLORS)).toHaveLength(9);
  });

  it("todos son strings hexadecimales validos", () => {
    Object.values(RANGE_COLORS).forEach((color) => {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});

describe("SEVERITY_GRUPOS", () => {
  it("tiene 3 grupos de severidad", () => {
    expect(SEVERITY_GRUPOS).toHaveLength(3);
  });

  it("cada grupo tiene los campos requeridos", () => {
    SEVERITY_GRUPOS.forEach((grupo) => {
      expect(grupo).toHaveProperty("key");
      expect(grupo).toHaveProperty("label");
      expect(grupo).toHaveProperty("color");
      expect(grupo).toHaveProperty("rangos");
      expect(grupo.rangos.length).toBeGreaterThan(0);
    });
  });
});

describe("SEVERITY_COLORS", () => {
  it("tiene los 4 niveles de alerta de cupo", () => {
    expect(SEVERITY_COLORS).toHaveProperty("critica");
    expect(SEVERITY_COLORS).toHaveProperty("alta");
    expect(SEVERITY_COLORS).toHaveProperty("media");
    expect(SEVERITY_COLORS).toHaveProperty("baja");
  });
});
