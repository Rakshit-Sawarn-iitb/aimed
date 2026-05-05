import { useEffect, useState } from 'react';
import { api, ApiError, auth } from '@/lib/api';

export interface MeResponse {
  id: string;
  phone: string | null;
  role: 'doctor' | 'patient' | null;
  is_new: boolean;
  profile: Record<string, unknown> | null;
}

export function useMe() {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await api.get<MeResponse>('/auth/me');
        if (alive) setMe(res);
      } catch (err) {
        if (alive) setError(err instanceof ApiError ? err.message : 'Failed to load profile');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* ignore */ }
    auth.clear();
    window.location.href = '/login';
  };

  return { me, loading, error, logout };
}

export function profileName(me: MeResponse | null): string {
  if (!me?.profile) return '';
  const p = me.profile as { name?: string };
  return p.name ?? '';
}
