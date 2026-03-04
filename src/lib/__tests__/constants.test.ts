import { describe, it, expect } from "vitest";
import { CHART_COLORS, SEVERITY_COLORS } from "../constants";

describe("CHART_COLORS", () => {
  it("tiene 5 colores para los rangos de envejecimiento", () => {
    expect(CHART_COLORS).toHaveLength(5);
  });

  it("todos son strings hexadecimales validos", () => {
    CHART_COLORS.forEach((color) => {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });
  });
});

describe("SEVERITY_COLORS", () => {
  it("tiene los 4 niveles de severidad", () => {
    expect(SEVERITY_COLORS).toHaveProperty("critica");
    expect(SEVERITY_COLORS).toHaveProperty("alta");
    expect(SEVERITY_COLORS).toHaveProperty("media");
    expect(SEVERITY_COLORS).toHaveProperty("baja");
  });
});
