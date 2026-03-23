import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SlideOver } from './SlideOver';

const defaultProps = {
  title: 'Test Panel',
  onClose: () => {},
  footer: <div>Footer content</div>,
};

describe('SlideOver', () => {
  it('renders title when open', () => {
    render(<SlideOver {...defaultProps} open><p>Body</p></SlideOver>);
    expect(screen.getByText('Test Panel')).toBeInTheDocument();
  });

  it('renders children inside panel', () => {
    render(<SlideOver {...defaultProps} open><p>Panel body content</p></SlideOver>);
    expect(screen.getByText('Panel body content')).toBeInTheDocument();
  });

  it('renders footer content', () => {
    render(<SlideOver {...defaultProps} open><p>Body</p></SlideOver>);
    expect(screen.getByText('Footer content')).toBeInTheDocument();
  });

  it('panel is off-screen (translate-x-full) when open={false}', () => {
    const { container } = render(
      <SlideOver {...defaultProps} open={false}><p>Body</p></SlideOver>
    );
    const panel = container.querySelector('.translate-x-full');
    expect(panel).toBeInTheDocument();
  });

  it('panel is visible (translate-x-0) when open={true}', () => {
    const { container } = render(
      <SlideOver {...defaultProps} open><p>Body</p></SlideOver>
    );
    const panel = container.querySelector('.translate-x-0');
    expect(panel).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn();
    render(<SlideOver {...defaultProps} open onClose={onClose}><p>Body</p></SlideOver>);
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn();
    const { container } = render(
      <SlideOver {...defaultProps} open onClose={onClose}><p>Body</p></SlideOver>
    );
    // Backdrop is the first child div (opacity-100 class when open)
    const backdrop = container.querySelector('.opacity-100');
    await userEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalledOnce();
  });
});
