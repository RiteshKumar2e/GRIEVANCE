import "@testing-library/jest-dom/vitest";

window.scrollTo = (() => undefined) as typeof window.scrollTo;

// jsdom has no ResizeObserver; Recharts' ResponsiveContainer needs one. Layout is not under test.
if (!("ResizeObserver" in globalThis)) {
  (globalThis as Record<string, unknown>).ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
