import { render, RenderOptions } from '@testing-library/react';
import React, { ReactElement } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ToastProvider } from '../context/ToastContext';

export const mockAuthValue = {
  apiKey: 'test-api-key',
  userEmail: 'test@example.com',
  isReady: true,
  login: () => {},
  logout: () => {},
  setUnauthorized: () => {},
};

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthContext.Provider value={mockAuthValue}>
      <ToastProvider>{children}</ToastProvider>
    </AuthContext.Provider>
  );
}

/** Render a component with Router + AuthContext + ToastProvider. */
export function renderWithProviders(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter>
      <Providers>{children}</Providers>
    </MemoryRouter>
  );
  return render(ui, { wrapper: Wrapper, ...options });
}

/**
 * Render a page component that uses useParams.
 * Provides the route via MemoryRouter + Routes + Route.
 *
 * @param ui        The page component element
 * @param path      Route path pattern, e.g. '/pipelines/:id'
 * @param entry     The URL to navigate to, e.g. '/pipelines/pipe-1'
 */
export function renderWithRoute(
  ui: ReactElement,
  path: string,
  entry: string,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Providers>
        <Routes>
          <Route path={path} element={ui} />
        </Routes>
      </Providers>
    </MemoryRouter>,
    options
  );
}
