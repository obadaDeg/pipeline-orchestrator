import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Toast } from './Toast';

const successToast = { id: 'toast-1', message: 'Pipeline created', type: 'success' as const };
const errorToast = { id: 'toast-2', message: 'Something failed', type: 'error' as const };

describe('Toast', () => {
  it('renders the toast message', () => {
    render(<Toast toast={successToast} onDismiss={() => {}} />);
    expect(screen.getByText('Pipeline created')).toBeInTheDocument();
  });

  it('success toast has green styling', () => {
    const { container } = render(<Toast toast={successToast} onDismiss={() => {}} />);
    expect(container.firstChild).toHaveClass('bg-green-50', 'text-green-800');
  });

  it('error toast has red styling', () => {
    const { container } = render(<Toast toast={errorToast} onDismiss={() => {}} />);
    expect(container.firstChild).toHaveClass('bg-red-50', 'text-red-800');
  });

  it('renders a dismiss button', () => {
    render(<Toast toast={successToast} onDismiss={() => {}} />);
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('calls onDismiss with toast id when dismiss button is clicked', async () => {
    const onDismiss = vi.fn();
    render(<Toast toast={successToast} onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledWith('toast-1');
  });

  it('success toast renders a check icon (svg)', () => {
    const { container } = render(<Toast toast={successToast} onDismiss={() => {}} />);
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(1);
  });

  it('error toast renders an error icon (svg)', () => {
    const { container } = render(<Toast toast={errorToast} onDismiss={() => {}} />);
    expect(container.querySelectorAll('svg').length).toBeGreaterThanOrEqual(1);
  });
});
