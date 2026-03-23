import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SkeletonCard } from './SkeletonCard';

describe('SkeletonCard', () => {
  it('renders with animate-pulse class', () => {
    const { container } = render(<SkeletonCard />);
    expect(container.firstChild).toHaveClass('animate-pulse');
  });

  it('renders shimmer bar elements for loading skeleton', () => {
    const { container } = render(<SkeletonCard />);
    const bars = container.querySelectorAll('.bg-gray-200');
    expect(bars.length).toBeGreaterThanOrEqual(3);
  });
});
