import { describe, it, expect } from 'vitest';

describe('test infra', () => {
  it('runs vitest with globals and jsdom', () => {
    expect(typeof window).toBe('object');
    expect(document.createElement('div')).toBeInstanceOf(HTMLElement);
  });

  it('has jest-dom matchers extended on expect', () => {
    const el = document.createElement('div');
    el.textContent = 'hi';
    document.body.appendChild(el);
    expect(el).toBeInTheDocument();
    expect(el).toHaveTextContent('hi');
  });
});
