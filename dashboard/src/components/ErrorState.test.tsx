import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ErrorState } from './ErrorState';

describe('ErrorState', () => {
  it('renders the error message', () => {
    render(<ErrorState error="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('renders retry button when onRetry is provided', () => {
    render(<ErrorState error="Oops" onRetry={() => {}} />);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('does not render retry button when onRetry is omitted', () => {
    render(<ErrorState error="Oops" />);
    expect(screen.queryByRole('button', { name: 'Retry' })).not.toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', async () => {
    const onRetry = vi.fn();
    render(<ErrorState error="Oops" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders an alert icon', () => {
    const { container } = render(<ErrorState error="Error" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
