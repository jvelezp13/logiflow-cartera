import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Sidebar } from "../sidebar";

// Mock de next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

describe("Sidebar", () => {
  it("renderiza los items de navegacion principales", () => {
    render(<Sidebar />);

    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Clientes")).toBeInTheDocument();
    expect(screen.getByText("Envejecimiento")).toBeInTheDocument();
    expect(screen.getByText("Alertas")).toBeInTheDocument();
    expect(screen.getByText("Configuracion")).toBeInTheDocument();
  });

  it("no muestra Usuarios para viewer", () => {
    render(<Sidebar userRole="viewer" />);
    expect(screen.queryByText("Usuarios")).not.toBeInTheDocument();
  });

  it("muestra Usuarios para admin", () => {
    render(<Sidebar userRole="admin" />);
    expect(screen.getByText("Usuarios")).toBeInTheDocument();
  });

  it("muestra Tenants solo para super_admin", () => {
    render(<Sidebar userRole="super_admin" />);
    expect(screen.getByText("Tenants")).toBeInTheDocument();
  });

  it("no muestra Tenants para admin", () => {
    render(<Sidebar userRole="admin" />);
    expect(screen.queryByText("Tenants")).not.toBeInTheDocument();
  });

  it("tiene aria-label en el nav", () => {
    render(<Sidebar />);
    const nav = screen.getByRole("navigation", { name: "Navegacion principal" });
    expect(nav).toBeInTheDocument();
  });
});
