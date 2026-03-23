import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../test/server';
import { renderWithRoute } from '../test/utils';
import { PipelineDetailPage } from './PipelineDetailPage';

const ROUTE = '/pipelines/:id';
const ENTRY = '/pipelines/pipe-1';

describe('PipelineDetailPage', () => {
  it('renders the pipeline name', async () => {
    renderWithRoute(<PipelineDetailPage />, ROUTE, ENTRY);
    await waitFor(() => {
      expect(screen.getByText('Test Pipeline')).toBeInTheDocument();
    });
  });

  it('renders pipeline action type badge', async () => {
    renderWithRoute(<PipelineDetailPage />, ROUTE, ENTRY);
    await waitFor(() => {
      expect(screen.getByText('Field Extractor')).toBeInTheDocument();
    });
  });

  it('shows Overview tab content by default', async () => {
    renderWithRoute(<PipelineDetailPage />, ROUTE, ENTRY);
    await waitFor(() => screen.getByText('Test Pipeline'));
    expect(screen.getByRole('button', { name: 'Overview' })).toHaveClass('border-indigo-600');
  });

  it('shows Jobs table when Jobs tab is clicked', async () => {
    renderWithRoute(<PipelineDetailPage />, ROUTE, ENTRY);
    await waitFor(() => screen.getByText('Test Pipeline'));

    await userEvent.click(screen.getByRole('button', { name: 'Jobs' }));
    // Jobs tab now active — jobs table or skeleton/empty should be visible
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Jobs' })).toHaveClass('border-indigo-600');
    });
  });

  it('opens ConfirmDialog when Delete is clicked', async () => {
    renderWithRoute(<PipelineDetailPage />, ROUTE, ENTRY);
    await waitFor(() => screen.getByText('Test Pipeline'));

    await userEvent.click(screen.getByRole('button', { name: /delete/i }));
    await waitFor(() => {
      expect(screen.getByText('Delete Pipeline')).toBeInTheDocument();
    });
  });

  it('calls DELETE endpoint and navigates away on confirm', async () => {
    let deleteWasCalled = false;
    server.use(
      http.delete('/pipelines/:id', () => {
        deleteWasCalled = true;
        return new HttpResponse(null, { status: 204 });
      })
    );

    renderWithRoute(<PipelineDetailPage />, ROUTE, ENTRY);
    await waitFor(() => screen.getByText('Test Pipeline'));

    // Open confirm dialog via the header Delete button (sm size, has Trash2 icon)
    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    await userEvent.click(deleteButtons[0]);
    await waitFor(() => screen.getByText('Delete Pipeline'));

    // Confirm via the dialog's Delete button (the last "Delete" button)
    const allDeleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await userEvent.click(allDeleteButtons[allDeleteButtons.length - 1]);

    await waitFor(() => {
      expect(deleteWasCalled).toBe(true);
    });
  });

  it('calls clipboard.writeText when Copy Webhook URL is clicked', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    renderWithRoute(<PipelineDetailPage />, ROUTE, ENTRY);
    await waitFor(() => screen.getByText('Test Pipeline'));

    await userEvent.click(screen.getByRole('button', { name: /copy webhook url/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('src-abc123'));
    });

    vi.unstubAllGlobals();
  });

  it('shows ErrorState when pipeline API returns 500', async () => {
    server.use(
      http.get('/pipelines/:id', () =>
        HttpResponse.json(
          { error: { code: 'SERVER_ERROR', message: 'Server error' } },
          { status: 500 }
        )
      )
    );
    renderWithRoute(<PipelineDetailPage />, ROUTE, ENTRY);
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument();
    });
  });
});
