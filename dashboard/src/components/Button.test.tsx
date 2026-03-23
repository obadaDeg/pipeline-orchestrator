import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders children text', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('applies primary variant styles by default', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-indigo-600');
  });

  it('applies danger variant styles', () => {
    render(<Button variant="danger">Delete</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-red-600');
  });

  it('applies secondary variant styles', () => {
    render(<Button variant="secondary">Cancel</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-white', 'border-gray-300');
  });

  it('is disabled and shows spinner when loading={true}', () => {
    render(<Button loading>Saving</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    // Loader2 renders an svg — assert it's present inside the button
    expect(btn.querySelector('svg')).toBeInTheDocument();
  });

  it('is disabled when disabled prop is set', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('calls onClick when clicked and not disabled', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('does not call onClick when disabled', async () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('does not call onClick when loading', async () => {
    const onClick = vi.fn();
    render(<Button loading onClick={onClick}>Click</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
