import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { TeamsPage } from './TeamsPage';

describe('TeamsPage', () => {
  it('renders team list from GET /teams', async () => {
    renderWithProviders(<TeamsPage />);
    await waitFor(() => {
      expect(screen.getByText('Test Team')).toBeInTheDocument();
    });
  });

  it('shows "Owner" badge for owned team', async () => {
    renderWithProviders(<TeamsPage />);
    await waitFor(() => {
      expect(screen.getByText('Owner')).toBeInTheDocument();
    });
  });

  it('shows empty state when no teams returned', async () => {
    server.use(
      http.get('/teams', () =>
        HttpResponse.json({ data: { items: [] } })
      )
    );

    renderWithProviders(<TeamsPage />);
    await waitFor(() => {
      expect(screen.getByText('No teams yet')).toBeInTheDocument();
    });
  });

  it('shows New Team form when "New Team" button is clicked', async () => {
    renderWithProviders(<TeamsPage />);
    await waitFor(() => screen.getByText('Test Team'));

    await userEvent.click(screen.getByRole('button', { name: /new team/i }));
    expect(screen.getByPlaceholderText(/team name/i)).toBeInTheDocument();
  });

  it('submits POST /teams when create form is submitted', async () => {
    let requestBody: unknown;
    server.use(
      http.post('/teams', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(
          {
            data: {
              id: 'team-new',
              name: 'My New Team',
              ownerUserId: 'user-1',
              createdAt: '2026-01-01T00:00:00.000Z',
            },
          },
          { status: 201 }
        );
      })
    );

    renderWithProviders(<TeamsPage />);
    await waitFor(() => screen.getByText('Test Team'));

    await userEvent.click(screen.getByRole('button', { name: /new team/i }));
    await userEvent.type(screen.getByPlaceholderText(/team name/i), 'My New Team');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));

    await waitFor(() => {
      expect(requestBody).toMatchObject({ name: 'My New Team' });
    });
  });
});
