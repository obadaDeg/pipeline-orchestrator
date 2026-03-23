import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderWithRoute } from '../test/utils';
import { JobDetailPage } from './JobDetailPage';

const ROUTE = '/jobs/:id';
const ENTRY = '/jobs/job-1';

describe('JobDetailPage', () => {
  it('renders job status badge', async () => {
    renderWithRoute(<JobDetailPage />, ROUTE, ENTRY);
    await waitFor(() => {
      // Job status COMPLETED badge
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });

  it('renders all delivery attempt rows', async () => {
    renderWithRoute(<JobDetailPage />, ROUTE, ENTRY);
    await waitFor(() => {
      // 3 delivery attempts: da-1 (SUCCESS), da-2 (FAILED), da-3 (SUCCESS) — 2 Success badges
      const successBadges = screen.getAllByText('Success');
      expect(successBadges.length).toBe(2);
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });
  });

  it('failed delivery attempt row has red left border styling', async () => {
    const { container } = renderWithRoute(<JobDetailPage />, ROUTE, ENTRY);
    await waitFor(() => {
      screen.getByText('Failed');
    });
    // Failed attempt rows get bg-red-50 and border-l-red-400 classes
    const failedRow = container.querySelector('.bg-red-50.border-l-red-400');
    expect(failedRow).toBeInTheDocument();
  });

  it('expands attempt row to show response snippet on click', async () => {
    renderWithRoute(<JobDetailPage />, ROUTE, ENTRY);
    await waitFor(() => screen.getByText('Failed'));

    // Click the failed attempt row (da-2) to expand it
    const failedRows = document.querySelectorAll('.bg-red-50.border-l-red-400');
    if (failedRows.length > 0) {
      await userEvent.click(failedRows[0] as HTMLElement);
      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });
    }
  });
});
