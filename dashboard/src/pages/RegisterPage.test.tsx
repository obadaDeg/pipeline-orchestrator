import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { server } from '../test/server';
import { renderWithProviders } from '../test/utils';
import { RegisterPage } from './RegisterPage';

// RegisterPage calls auth.login on success — mock the module to capture the call
vi.mock('../context/AuthContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../context/AuthContext')>();
  return {
    ...actual,
    useAuth: () => ({
      login: vi.fn(),
      logout: vi.fn(),
      apiKey: null,
      userEmail: null,
      isReady: true,
      setUnauthorized: vi.fn(),
    }),
  };
});

describe('RegisterPage', () => {
  it('renders email and password fields', () => {
    renderWithProviders(<RegisterPage />);
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('shows inline error without network call when password is too short', async () => {
    renderWithProviders(<RegisterPage />);

    await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'short');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
  });

  it('valid submission calls POST /auth/register', async () => {
    let requestBody: unknown;
    server.use(
      http.post('/auth/register', async ({ request }) => {
        requestBody = await request.json();
        return HttpResponse.json(
          {
            data: {
              user: { id: 'u1', email: 'new@example.com', createdAt: '2026-01-01T00:00:00.000Z' },
              apiKey: { id: 'k1', name: 'Default', key: 'wh_test_newkey', keyPrefix: 'wh_test', createdAt: '2026-01-01T00:00:00.000Z' },
            },
          },
          { status: 201 }
        );
      })
    );

    renderWithProviders(<RegisterPage />);

    await userEvent.type(screen.getByLabelText(/email address/i), 'new@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'securepass123');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(requestBody).toMatchObject({ email: 'new@example.com', password: 'securepass123' });
    });
  });

  it('shows generic error message on server failure', async () => {
    server.use(
      http.post('/auth/register', () =>
        HttpResponse.json(
          { error: { code: 'SERVER_ERROR', message: 'Registration failed' } },
          { status: 500 }
        )
      )
    );

    renderWithProviders(<RegisterPage />);

    await userEvent.type(screen.getByLabelText(/email address/i), 'test@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'validpass123');
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/registration failed/i)).toBeInTheDocument();
    });
  });

  it('has a sign in link pointing to /login', () => {
    renderWithProviders(<RegisterPage />);
    const link = screen.getByRole('link', { name: /sign in/i });
    expect(link).toHaveAttribute('href', '/login');
  });
});
