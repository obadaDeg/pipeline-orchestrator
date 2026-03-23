import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { AccountPage } from './AccountPage';

describe('AccountPage', () => {
  it('renders existing API key row with key prefix', async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByText('My Key')).toBeInTheDocument();
    });
  });

  it('renders key prefix with ellipsis', async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => {
      expect(screen.getByText('wh_test…')).toBeInTheDocument();
    });
  });

  it('shows skeleton rows while loading', () => {
    const { container } = renderWithProviders(<AccountPage />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('creates a new key and shows one-time reveal CodeBlock', async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => screen.getByText('My Key'));

    const nameInput = screen.getByPlaceholderText(/key name/i);
    await userEvent.type(nameInput, 'New Key');
    await userEvent.click(screen.getByRole('button', { name: 'Create Key' }));

    // One-time key reveal: CodeBlock showing the raw key value
    await waitFor(() => {
      const pre = document.querySelector('pre');
      expect(pre).toBeInTheDocument();
      expect(pre!.textContent).toContain('wh_test_abc123secretkey456');
    });
  });

  it('opens ConfirmDialog when Revoke is clicked', async () => {
    renderWithProviders(<AccountPage />);
    await waitFor(() => screen.getByText('My Key'));

    // Click the row-level Revoke button (first one)
    const revokeButtons = screen.getAllByRole('button', { name: /revoke/i });
    await userEvent.click(revokeButtons[0]);
    await waitFor(() => {
      expect(screen.getByText('Revoke API Key')).toBeInTheDocument();
    });
  });

  it('removes key row after revoke is confirmed', async () => {
    server.use(
      http.delete('/auth/keys/:id', () => new HttpResponse(null, { status: 204 }))
    );
    renderWithProviders(<AccountPage />);
    await waitFor(() => screen.getByText('My Key'));

    // Open dialog via row Revoke button
    const revokeButtons = screen.getAllByRole('button', { name: /revoke/i });
    await userEvent.click(revokeButtons[0]);
    await waitFor(() => screen.getByText('Revoke API Key'));

    // Confirm: click the dialog's Revoke button (last of the Revoke buttons)
    const allRevokeButtons = screen.getAllByRole('button', { name: 'Revoke' });
    await userEvent.click(allRevokeButtons[allRevokeButtons.length - 1]);

    await waitFor(() => {
      expect(screen.queryByText('My Key')).not.toBeInTheDocument();
    });
  });
});
