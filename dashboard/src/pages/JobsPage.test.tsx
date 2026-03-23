import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { JobsPage } from './JobsPage';

describe('JobsPage', () => {
  it('renders job row with status badge after loading', async () => {
    renderWithProviders(<JobsPage />);
    await waitFor(() => {
      expect(screen.getByText('Completed')).toBeInTheDocument();
    });
  });

  it('shows skeleton rows while loading', () => {
    const { container } = renderWithProviders(<JobsPage />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows EmptyState when no jobs returned', async () => {
    server.use(
      http.get('/jobs', () =>
        HttpResponse.json({ data: { items: [], total: 0, page: 1, limit: 20 } })
      )
    );
    renderWithProviders(<JobsPage />);
    await waitFor(() => {
      expect(screen.getByText('No jobs yet')).toBeInTheDocument();
    });
  });

  it('shows ErrorState when API fails', async () => {
    server.use(
      http.get('/jobs', () =>
        HttpResponse.json(
          { error: { code: 'SERVER_ERROR', message: 'Jobs unavailable' } },
          { status: 500 }
        )
      )
    );
    renderWithProviders(<JobsPage />);
    await waitFor(() => {
      expect(screen.getByText('Jobs unavailable')).toBeInTheDocument();
    });
  });
});
