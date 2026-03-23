import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkeletonRow } from './SkeletonRow';

describe('SkeletonRow', () => {
  it('renders as a <tr> element', () => {
    const { container } = render(
      <table><tbody><SkeletonRow /></tbody></table>
    );
    expect(container.querySelector('tr')).toBeInTheDocument();
  });

  it('renders 4 <td> cells by default', () => {
    const { container } = render(
      <table><tbody><SkeletonRow /></tbody></table>
    );
    expect(container.querySelectorAll('td')).toHaveLength(4);
  });

  it('renders the specified number of <td> cells when columns prop is set', () => {
    const { container } = render(
      <table><tbody><SkeletonRow columns={6} /></tbody></table>
    );
    expect(container.querySelectorAll('td')).toHaveLength(6);
  });

  it('applies animate-pulse class to the row', () => {
    const { container } = render(
      <table><tbody><SkeletonRow /></tbody></table>
    );
    expect(container.querySelector('tr')).toHaveClass('animate-pulse');
  });
});
