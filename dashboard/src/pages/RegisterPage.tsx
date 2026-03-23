import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/Button';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';

const MIN_PASSWORD_LENGTH = 8;

interface RegisterResponse {
  user: { id: string; email: string; createdAt: string };
  apiKey: { id: string; name: string; key: string; keyPrefix: string; createdAt: string };
}

export function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const { apiFetch } = useApi();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setPasswordError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }
    setPasswordError(null);
    setIsLoading(true);

    try {
      const response = await apiFetch<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      login(response.apiKey.key, response.user.email);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-10 rounded-2xl shadow-lg border border-gray-100">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
            Create an account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Pipeline Orchestrator
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPasswordError(null); }}
                disabled={isLoading}
              />
              {passwordError && (
                <p className="text-xs text-red-600 mt-1">{passwordError}</p>
              )}
            </div>
          </div>

          {error && (
            <div className="text-sm font-medium text-red-600 bg-red-50 py-2 px-3 rounded text-center">
              {error}
            </div>
          )}

          <div>
            <Button type="submit" loading={isLoading} className="w-full py-3">
              Create account
            </Button>
          </div>

          <p className="text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-500">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
