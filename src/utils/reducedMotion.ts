/**
 * Centralized reduced-motion gate.
 * SSR-safe: uses optional chaining so it returns false
 * in any environment where `globalThis.matchMedia` is absent.
 */
export function getReducedMotion(): boolean {
  return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
