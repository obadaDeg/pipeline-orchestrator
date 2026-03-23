import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { PipelineListPage } from './PipelineListPage';

describe('PipelineListPage', () => {
  it('renders pipeline card with name from API response', async () => {
    renderWithProviders(<PipelineListPage />);
    await waitFor(() => {
      expect(screen.getByText('Test Pipeline')).toBeInTheDocument();
    });
  });

  it('shows skeleton cards while loading', () => {
    renderWithProviders(<PipelineListPage />);
    // SkeletonCard renders animate-pulse divs before API resolves
    const { container } = renderWithProviders(<PipelineListPage />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('shows ErrorState when API returns 500', async () => {
    server.use(
      http.get('/pipelines', () =>
        HttpResponse.json(
          { error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
          { status: 500 }
        )
      )
    );
    renderWithProviders(<PipelineListPage />);
    await waitFor(() => {
      expect(screen.getByText('Internal server error')).toBeInTheDocument();
    });
  });

  it('shows EmptyState with "No pipelines yet" heading when API returns empty list', async () => {
    server.use(
      http.get('/pipelines', () =>
        HttpResponse.json({ data: { items: [], total: 0, page: 1, limit: 20 } })
      )
    );
    renderWithProviders(<PipelineListPage />);
    await waitFor(() => {
      expect(screen.getByText('No pipelines yet')).toBeInTheDocument();
    });
  });

  it('opens SlideOver when New Pipeline button is clicked', async () => {
    renderWithProviders(<PipelineListPage />);
    await waitFor(() => screen.getByText('Test Pipeline'));

    await userEvent.click(screen.getByRole('button', { name: 'New Pipeline' }));
    // SlideOver title appears
    await waitFor(() => {
      expect(screen.getByText('New Pipeline', { selector: 'h2' })).toBeInTheDocument();
    });
  });
});
