import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../test/server';
import { renderWithRoute } from '../test/utils';
import { SigningSecretPanel } from './SigningSecretPanel';

const PIPELINE_ID = 'pipe-1';

function render() {
  return renderWithRoute(
    <SigningSecretPanel pipelineId={PIPELINE_ID} />,
    '/',
    '/',
  );
}

describe('SigningSecretPanel', () => {
  it('renders "Not configured" state when active: false', async () => {
    // default handler returns { active: false }
    render();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /generate secret/i })).toBeInTheDocument();
    });
  });

  it('renders hint and action buttons when active: true', async () => {
    server.use(
      http.get('/pipelines/:id/signing-secret', () =>
        HttpResponse.json({
          data: { active: true, hint: 'abc123', createdAt: '2026-01-01T00:00:00.000Z' },
        })
      )
    );

    render();
    await waitFor(() => {
      expect(screen.getByText(/Hint: abc123/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /rotate/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /revoke/i })).toBeInTheDocument();
    });
  });

  it('Generate button calls POST and shows revealed secret', async () => {
    render();
    await waitFor(() => screen.getByRole('button', { name: /generate secret/i }));

    await userEvent.click(screen.getByRole('button', { name: /generate secret/i }));

    await waitFor(() => {
      // The secret input is shown in the revealed state
      expect(screen.getByDisplayValue('abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890')).toBeInTheDocument();
    });
    expect(screen.getByText(/only time this secret will be shown/i)).toBeInTheDocument();
  });

  it('Rotate shows ConfirmDialog before calling POST', async () => {
    server.use(
      http.get('/pipelines/:id/signing-secret', () =>
        HttpResponse.json({
          data: { active: true, hint: 'abc123', createdAt: '2026-01-01T00:00:00.000Z' },
        })
      )
    );

    render();
    await waitFor(() => screen.getByRole('button', { name: /rotate/i }));

    await userEvent.click(screen.getByRole('button', { name: /rotate/i }));

    await waitFor(() => {
      expect(screen.getByText('Rotate Signing Secret')).toBeInTheDocument();
    });
  });

  it('Revoke shows ConfirmDialog before calling DELETE', async () => {
    server.use(
      http.get('/pipelines/:id/signing-secret', () =>
        HttpResponse.json({
          data: { active: true, hint: 'abc123', createdAt: '2026-01-01T00:00:00.000Z' },
        })
      )
    );

    render();
    await waitFor(() => screen.getByRole('button', { name: /revoke/i }));

    await userEvent.click(screen.getByRole('button', { name: /revoke/i }));

    await waitFor(() => {
      expect(screen.getByText('Revoke Signing Secret')).toBeInTheDocument();
    });
  });

  it('secret field is not visible after revoke completes', async () => {
    // Start in revealed state by generating first
    render();
    await waitFor(() => screen.getByRole('button', { name: /generate secret/i }));
    await userEvent.click(screen.getByRole('button', { name: /generate secret/i }));
    await waitFor(() => screen.getByText(/only time this secret will be shown/i));

    // Revoke via dialog
    await userEvent.click(screen.getByRole('button', { name: /^revoke$/i }));
    await waitFor(() => screen.getByText('Revoke Signing Secret'));
    const confirmButtons = screen.getAllByRole('button', { name: /^revoke$/i });
    await userEvent.click(confirmButtons[confirmButtons.length - 1]);

    await waitFor(() => {
      expect(screen.queryByText(/only time this secret will be shown/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /generate secret/i })).toBeInTheDocument();
    });
  });
});
