// Stub window.matchMedia for jsdom environments. Svelte 5's svelte/motion
// module creates a prefersReducedMotion singleton at import time via MediaQuery,
// which calls window.matchMedia() — undefined by default in jsdom.
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}
