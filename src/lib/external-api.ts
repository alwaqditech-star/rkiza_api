import { cookies } from 'next/headers';
import { AUTH_COOKIE_NAME } from '@/lib/auth';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(AUTH_COOKIE_NAME)?.value ?? null;
}

export async function proxyToApi(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const token = await getAuthToken();
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
    cache: 'no-store',
  });
}

export async function callApi<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T }> {
  const response = await proxyToApi(path, options);
  const data = (await response.json()) as T;
  return { ok: response.ok, status: response.status, data };
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/health`, {
      cache: 'no-store',
    });
    const data = await response.json();
    return response.ok && !!(data as { success?: boolean }).success;
  } catch {
    return false;
  }
}
