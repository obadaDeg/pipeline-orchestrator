import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('renders nothing when totalPages <= 1', () => {
    const { container } = render(
      <Pagination page={1} totalPages={1} onPageChange={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders page count text for multiple pages', () => {
    render(<Pagination page={2} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByText(/page/i)).toBeInTheDocument();
    // Shows "Page 2 of 5"
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('Previous button is disabled on page 1', () => {
    render(<Pagination page={1} totalPages={3} onPageChange={() => {}} />);
    const prevButtons = screen.getAllByRole('button', { name: 'Previous' });
    prevButtons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it('Next button is disabled on last page', () => {
    render(<Pagination page={3} totalPages={3} onPageChange={() => {}} />);
    const nextButtons = screen.getAllByRole('button', { name: 'Next' });
    nextButtons.forEach((btn) => expect(btn).toBeDisabled());
  });

  it('calls onPageChange with page - 1 when Previous is clicked', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={3} totalPages={5} onPageChange={onPageChange} />);
    const prevButtons = screen.getAllByRole('button', { name: 'Previous' });
    await userEvent.click(prevButtons[0]);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange with page + 1 when Next is clicked', async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} totalPages={5} onPageChange={onPageChange} />);
    const nextButtons = screen.getAllByRole('button', { name: 'Next' });
    await userEvent.click(nextButtons[0]);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });
});
