import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders completed variant with green style and correct label', () => {
    render(<Badge variant="completed" />);
    const badge = screen.getByText('Completed');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveClass('bg-green-100', 'text-green-700');
  });

  it('renders failed variant with red style', () => {
    render(<Badge variant="failed" />);
    expect(screen.getByText('Failed')).toHaveClass('bg-red-100', 'text-red-700');
  });

  it('renders pending variant with amber style', () => {
    render(<Badge variant="pending" />);
    expect(screen.getByText('Pending')).toHaveClass('bg-amber-100', 'text-amber-700');
  });

  it('renders processing variant with blue style', () => {
    render(<Badge variant="processing" />);
    expect(screen.getByText('Processing')).toHaveClass('bg-blue-100', 'text-blue-700');
  });

  it('renders field_extractor action type variant', () => {
    render(<Badge variant="field_extractor" />);
    expect(screen.getByText('Field Extractor')).toHaveClass('bg-blue-100', 'text-blue-700');
  });

  it('renders uppercase COMPLETED from old API without crashing', () => {
    render(<Badge variant="COMPLETED" />);
    expect(screen.getByText('Completed')).toBeInTheDocument();
  });

  it('renders uppercase FAILED from old API without crashing', () => {
    render(<Badge variant="FAILED" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('accepts deprecated status prop', () => {
    render(<Badge status="failed" />);
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('renders unknown variant as title-cased fallback without crashing', () => {
    render(<Badge variant="my_custom_step" />);
    expect(screen.getByText('My Custom Step')).toBeInTheDocument();
  });

  it('renders unknown variant with gray fallback style', () => {
    render(<Badge variant="unknown_thing" />);
    const badge = screen.getByText('Unknown Thing');
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-700');
  });
});
