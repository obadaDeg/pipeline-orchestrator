import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../test/server';
import { renderWithRoute } from '../test/utils';
import { TeamDetailPage } from './TeamDetailPage';

const ROUTE = '/teams/:id';
const ENTRY = '/teams/team-1';

function render() {
  return renderWithRoute(<TeamDetailPage />, ROUTE, ENTRY);
}

describe('TeamDetailPage', () => {
  it('renders the team name', async () => {
    render();
    await waitFor(() => {
      expect(screen.getByText('Test Team')).toBeInTheDocument();
    });
  });

  it('renders the members list', async () => {
    render();
    await waitFor(() => {
      expect(screen.getByText('member@example.com')).toBeInTheDocument();
    });
  });

  it('Add Member calls POST /teams/:id/members', async () => {
    let requestBody: unknown;
    server.use(
      http.post('/teams/:id/members', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(
          { data: { teamId: 'team-1', userId: 'user-new', addedAt: '2026-01-01T00:00:00.000Z' } },
          { status: 201 }
        );
      })
    );

    render();
    await waitFor(() => screen.getByText('Test Team'));

    await userEvent.type(
      screen.getByPlaceholderText(/member@example.com/i),
      'new@example.com',
    );
    await userEvent.click(screen.getByRole('button', { name: /add member/i }));

    await waitFor(() => {
      expect(requestBody).toMatchObject({ email: 'new@example.com' });
    });
  });

  it('Remove Member shows ConfirmDialog then calls DELETE', async () => {
    let deleteWasCalled = false;
    server.use(
      http.delete('/teams/:id/members/:userId', () => {
        deleteWasCalled = true;
        return new HttpResponse(null, { status: 204 });
      })
    );

    render();
    await waitFor(() => screen.getByText('member@example.com'));

    await userEvent.click(screen.getByRole('button', { name: /remove/i }));
    await waitFor(() => expect(screen.getByText('Remove Member')).toBeInTheDocument());

    // Confirm removal
    const confirmButtons = screen.getAllByRole('button', { name: /^remove$/i });
    await userEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(deleteWasCalled).toBe(true);
    });
  });

  it('Delete Team shows ConfirmDialog then calls DELETE /teams/:id', async () => {
    let deleteWasCalled = false;
    server.use(
      http.delete('/teams/:id', () => {
        deleteWasCalled = true;
        return new HttpResponse(null, { status: 204 });
      })
    );

    render();
    await waitFor(() => screen.getByText('Test Team'));

    await userEvent.click(screen.getByRole('button', { name: /delete team/i }));
    await waitFor(() =>
      expect(screen.getByText(/This will delete the team/i)).toBeInTheDocument()
    );

    const allDeleteButtons = screen.getAllByRole('button', { name: /delete team/i });
    await userEvent.click(allDeleteButtons[allDeleteButtons.length - 1]);

    await waitFor(() => {
      expect(deleteWasCalled).toBe(true);
    });
  });
});
