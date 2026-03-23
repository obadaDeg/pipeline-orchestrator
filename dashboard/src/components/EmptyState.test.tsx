import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LayoutGrid } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders heading', () => {
    render(<EmptyState heading="No pipelines yet" />);
    expect(screen.getByText('No pipelines yet')).toBeInTheDocument();
  });

  it('renders body text when provided', () => {
    render(<EmptyState heading="Empty" body="Create your first item." />);
    expect(screen.getByText('Create your first item.')).toBeInTheDocument();
  });

  it('does not render body when omitted', () => {
    render(<EmptyState heading="Empty" />);
    expect(screen.queryByText(/create/i)).not.toBeInTheDocument();
  });

  it('renders action button when action prop is provided', async () => {
    const onClick = vi.fn();
    render(
      <EmptyState
        heading="No pipelines yet"
        action={<button onClick={onClick}>New Pipeline</button>}
      />
    );
    expect(screen.getByRole('button', { name: 'New Pipeline' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New Pipeline' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders icon when icon prop provided', () => {
    const { container } = render(
      <EmptyState heading="Empty" icon={LayoutGrid} />
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders without icon when omitted', () => {
    const { container } = render(<EmptyState heading="Empty" />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
  });
});
