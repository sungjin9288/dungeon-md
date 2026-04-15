import { describe, it, expect } from 'vitest';

describe('vitest smoke test', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });

  it('has localStorage via happy-dom', () => {
    localStorage.setItem('foo', 'bar');
    expect(localStorage.getItem('foo')).toBe('bar');
    localStorage.clear();
  });
});
