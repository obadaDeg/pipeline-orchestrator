import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';

const defaultProps = {
  title: 'Delete pipeline',
  message: 'This action cannot be undone.',
  onConfirm: () => {},
  onCancel: () => {},
};

describe('ConfirmDialog', () => {
  it('renders nothing when open={false}', () => {
    render(<ConfirmDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Delete pipeline')).not.toBeInTheDocument();
  });

  it('renders title and message when open={true}', () => {
    render(<ConfirmDialog {...defaultProps} open />);
    expect(screen.getByText('Delete pipeline')).toBeInTheDocument();
    expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
  });

  it('calls onCancel when Cancel button is clicked', async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...defaultProps} open onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...defaultProps} open onConfirm={onConfirm} />);
    // Default confirmLabel is 'Delete'
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('renders custom confirmLabel', () => {
    render(<ConfirmDialog {...defaultProps} open confirmLabel="Revoke" />);
    expect(screen.getByRole('button', { name: 'Revoke' })).toBeInTheDocument();
  });

  it('confirm button has danger (red) styling', () => {
    render(<ConfirmDialog {...defaultProps} open />);
    // Danger variant uses bg-red-600
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('bg-red-600');
  });

  it('shows loading spinner on confirm button when loading={true}', () => {
    render(<ConfirmDialog {...defaultProps} open loading />);
    const confirmBtn = screen.getByRole('button', { name: 'Delete' });
    expect(confirmBtn).toBeDisabled();
    expect(confirmBtn.querySelector('svg')).toBeInTheDocument();
  });
});
