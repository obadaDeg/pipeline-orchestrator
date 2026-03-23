import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

export function useApi() {
  const { apiKey, setUnauthorized } = useAuth();

  const apiFetch = useCallback(async <T = unknown>(endpoint: string, options?: RequestInit): Promise<T> => {
    const headers = new Headers(options?.headers);
    if (apiKey) {
      headers.set('Authorization', `Bearer ${apiKey}`);
    }
    if (!headers.has('Content-Type') && options?.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(endpoint, {
      ...options,
      headers
    });

    if (response.status === 401) {
      setUnauthorized();
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      let errorMessage = 'An error occurred';
      try {
        const errorData = await response.json();
        errorMessage = errorData.error?.message || errorData.message || errorMessage;
      } catch {
        errorMessage = response.statusText || errorMessage;
      }
      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return {} as T;
    }

    const json = await response.json();
    return json.data !== undefined ? json.data : json;
  }, [apiKey, setUnauthorized]);

  return { apiFetch };
}
