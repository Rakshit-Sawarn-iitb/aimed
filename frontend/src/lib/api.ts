const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const ACCESS_KEY  = 'aimed_access_token';
const REFRESH_KEY = 'aimed_refresh_token';
const ROLE_KEY    = 'aimed_role';

export const auth = {
  getAccessToken:  () => localStorage.getItem(ACCESS_KEY),
  getRefreshToken: () => localStorage.getItem(REFRESH_KEY),
  getRole:         () => localStorage.getItem(ROLE_KEY),
  setSession: (access: string, refresh: string, role: string | null) => {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    if (role) localStorage.setItem(ROLE_KEY, role);
    else localStorage.removeItem(ROLE_KEY);
  },
  setRole: (role: string) => localStorage.setItem(ROLE_KEY, role),
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(ROLE_KEY);
  },
  isAuthenticated: () => !!localStorage.getItem(ACCESS_KEY),
};

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(status: number, detail: unknown, message: string) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

// ── Token refresh ────────────────────────────────────────────────────────────
//
// Module-level promise so that if N requests all get 401 simultaneously,
// only one refresh call goes out; the rest queue on the same promise.

let _refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (_refreshPromise) return _refreshPromise;

  _refreshPromise = (async () => {
    const refreshToken = auth.getRefreshToken();
    if (!refreshToken) throw new Error('No refresh token stored');

    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) throw new Error('Refresh failed');

    const data: { access_token: string; refresh_token: string } = await res.json();
    auth.setSession(data.access_token, data.refresh_token, auth.getRole());
    return data.access_token;
  })().finally(() => { _refreshPromise = null; });

  return _refreshPromise;
}

function redirectToLogin() {
  auth.clear();
  if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
  }
}

// ── Core fetch wrapper ───────────────────────────────────────────────────────

async function parseError(res: Response, method: string, path: string): Promise<ApiError> {
  let detail: unknown = null;
  try { detail = await res.json(); } catch { /* ignore */ }
  const msg = (detail && typeof detail === 'object' && 'detail' in detail)
    ? String((detail as { detail: unknown }).detail)
    : `API ${method} ${path}: ${res.status}`;
  return new ApiError(res.status, detail, msg);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = auth.getAccessToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // ── 401: try to refresh once, then retry ────────────────────────────────
  if (res.status === 401) {
    let newToken: string;
    try {
      newToken = await refreshAccessToken();
    } catch {
      redirectToLogin();
      throw new ApiError(401, null, 'Session expired. Please log in again.');
    }

    const retry = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${newToken}` },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (retry.status === 401) {
      redirectToLogin();
      throw new ApiError(401, null, 'Unauthorized');
    }
    if (!retry.ok) throw await parseError(retry, method, path);
    if (retry.status === 204) return undefined as T;
    return retry.json();
  }

  if (!res.ok) throw await parseError(res, method, path);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get:    <T>(path: string)                    => request<T>('GET',    path),
  post:   <T>(path: string, body?: unknown)    => request<T>('POST',   path, body),
  put:    <T>(path: string, body?: unknown)    => request<T>('PUT',    path, body),
  patch:  <T>(path: string, body?: unknown)    => request<T>('PATCH',  path, body),
  delete: <T>(path: string)                    => request<T>('DELETE', path),
};
