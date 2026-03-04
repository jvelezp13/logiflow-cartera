import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Limpiar DOM entre cada test
afterEach(() => {
  cleanup();
});
