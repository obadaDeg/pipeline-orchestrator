import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CodeBlock } from './CodeBlock';

describe('CodeBlock', () => {
  it('renders code content in the DOM', () => {
    render(<CodeBlock code='{"key":"value"}' />);
    // highlight.js sets textContent; the pre tag wraps it
    const pre = document.querySelector('pre');
    expect(pre).toBeInTheDocument();
    expect(pre!.textContent).toContain('key');
  });

  it('renders a <pre><code> structure', () => {
    const { container } = render(<CodeBlock code='{}' />);
    expect(container.querySelector('pre code')).toBeInTheDocument();
  });

  it('does not throw with empty string code', () => {
    expect(() => render(<CodeBlock code="" />)).not.toThrow();
  });
});
