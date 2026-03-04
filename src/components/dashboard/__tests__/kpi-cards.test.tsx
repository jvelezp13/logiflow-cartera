import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiCards } from "../kpi-cards";

const mockKpis = {
  cartera_total: 8_500_000,
  cartera_vencida: 2_300_000,
  cartera_por_vencer: 6_200_000,
  clientes_con_deuda: 42,
  facturas_vencidas: 15,
  facturas_por_vencer: 30,
};

describe("KpiCards", () => {
  it("renderiza los 4 KPIs principales", () => {
    render(<KpiCards kpis={mockKpis} alertasCount={7} />);

    expect(screen.getByText("Cartera Total")).toBeInTheDocument();
    expect(screen.getByText("Cartera Vencida")).toBeInTheDocument();
    expect(screen.getByText("Por Vencer")).toBeInTheDocument();
    expect(screen.getByText("Alertas")).toBeInTheDocument();
  });

  it("muestra los valores formateados correctamente", () => {
    render(<KpiCards kpis={mockKpis} alertasCount={7} />);

    // Cada valor es unico en el mock
    expect(screen.getByText("$8.5M")).toBeInTheDocument();
    expect(screen.getByText("$2.3M")).toBeInTheDocument();
    expect(screen.getByText("$6.2M")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("muestra el conteo de clientes y facturas", () => {
    render(<KpiCards kpis={mockKpis} alertasCount={0} />);
    expect(screen.getByText("42 clientes")).toBeInTheDocument();
    expect(screen.getByText("15 facturas")).toBeInTheDocument();
    expect(screen.getByText("30 facturas")).toBeInTheDocument();
  });
});
