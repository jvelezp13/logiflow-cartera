import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiCards } from "../kpi-cards";

const mockResumen = {
  gran_total: 86_298_649,
  total_facturas: 130,
  total_clientes: 49,
  grupos: [
    { severidad: "tolerable" as const, total: 43_122_094, cantidad_facturas: 84, cantidad_clientes: 36 },
    { severidad: "atencion" as const, total: 36_077_802, cantidad_facturas: 29, cantidad_clientes: 8 },
    { severidad: "critico" as const, total: 7_098_753, cantidad_facturas: 17, cantidad_clientes: 5 },
  ],
};

describe("KpiCards", () => {
  it("renderiza las 4 tarjetas (total + 3 severidades)", () => {
    render(<KpiCards resumen={mockResumen} />);

    expect(screen.getByText("Cartera Total")).toBeInTheDocument();
    expect(screen.getByText("Tolerable")).toBeInTheDocument();
    expect(screen.getByText("Atencion")).toBeInTheDocument();
    expect(screen.getByText("Critico")).toBeInTheDocument();
  });

  it("muestra los valores formateados correctamente", () => {
    render(<KpiCards resumen={mockResumen} />);

    expect(screen.getByText("$86.3M")).toBeInTheDocument();
    expect(screen.getByText("$43.1M")).toBeInTheDocument();
    expect(screen.getByText("$36.1M")).toBeInTheDocument();
    expect(screen.getByText("$7.1M")).toBeInTheDocument();
  });

  it("muestra facturas y clientes en cada tarjeta", () => {
    render(<KpiCards resumen={mockResumen} />);

    // Total
    expect(screen.getByText(/130 facturas/)).toBeInTheDocument();
    expect(screen.getByText(/49 clientes/)).toBeInTheDocument();
    // Tolerable
    expect(screen.getByText(/84 facturas/)).toBeInTheDocument();
    expect(screen.getByText(/36 clientes/)).toBeInTheDocument();
  });
});
