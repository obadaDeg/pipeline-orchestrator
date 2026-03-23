import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Tabs } from './Tabs';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'subscribers', label: 'Subscribers' },
];

describe('Tabs', () => {
  it('renders all tab labels', () => {
    render(<Tabs tabs={TABS} activeTab="overview" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jobs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Subscribers' })).toBeInTheDocument();
  });

  it('active tab has indigo border style', () => {
    render(<Tabs tabs={TABS} activeTab="jobs" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Jobs' })).toHaveClass('border-indigo-600', 'text-indigo-600');
  });

  it('inactive tabs have transparent border', () => {
    render(<Tabs tabs={TABS} activeTab="overview" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Jobs' })).toHaveClass('border-transparent');
  });

  it('calls onChange with the clicked tab key', async () => {
    const onChange = vi.fn();
    render(<Tabs tabs={TABS} activeTab="jobs" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Overview' }));
    expect(onChange).toHaveBeenCalledWith('overview');
  });

  it('calls onChange when clicking a non-active tab', async () => {
    const onChange = vi.fn();
    render(<Tabs tabs={TABS} activeTab="overview" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Subscribers' }));
    expect(onChange).toHaveBeenCalledWith('subscribers');
  });

  it('also calls onChange when clicking the active tab', async () => {
    const onChange = vi.fn();
    render(<Tabs tabs={TABS} activeTab="overview" onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Overview' }));
    expect(onChange).toHaveBeenCalledWith('overview');
  });
});
