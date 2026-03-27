import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "../sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("Sidebar", () => {
  it("renderiza los items de navegacion principales", () => {
    render(<Sidebar />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Clientes")).toBeInTheDocument();
    expect(screen.getByText("Facturas")).toBeInTheDocument();
    expect(screen.getByText("Pre-facturacion")).toBeInTheDocument();
    expect(screen.getByText("Alertas")).toBeInTheDocument();
  });

  it("no muestra items de administracion", () => {
    render(<Sidebar />);
    expect(screen.queryByText("Usuarios")).not.toBeInTheDocument();
    expect(screen.queryByText("Tenants")).not.toBeInTheDocument();
    expect(screen.queryByText("Configuracion")).not.toBeInTheDocument();
  });

  it("tiene aria-label en el nav", () => {
    render(<Sidebar />);
    const nav = screen.getByRole("navigation", { name: "Navegacion principal" });
    expect(nav).toBeInTheDocument();
  });
});
