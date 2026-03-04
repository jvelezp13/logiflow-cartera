import { describe, it, expect } from "vitest";
import { formatCurrencyShort, formatCurrencyFull } from "../format";

describe("formatCurrencyShort", () => {
  it("formatea millones con M", () => {
    expect(formatCurrencyShort(1_500_000)).toBe("$1.5M");
    expect(formatCurrencyShort(10_000_000)).toBe("$10.0M");
  });

  it("formatea miles con K", () => {
    expect(formatCurrencyShort(50_000)).toBe("$50K");
    expect(formatCurrencyShort(1_000)).toBe("$1K");
  });

  it("formatea valores menores a 1000 sin sufijo", () => {
    expect(formatCurrencyShort(500)).toBe("$500");
    expect(formatCurrencyShort(0)).toBe("$0");
  });

  it("maneja negativos", () => {
    expect(formatCurrencyShort(-500)).toBe("$-500");
  });
});

describe("formatCurrencyFull", () => {
  it("formatea con formato colombiano", () => {
    const result = formatCurrencyFull(1_500_000);
    // Intl puede usar diferentes separadores segun el entorno
    expect(result).toContain("1.500.000");
  });

  it("formatea cero", () => {
    const result = formatCurrencyFull(0);
    expect(result).toContain("0");
  });
});
