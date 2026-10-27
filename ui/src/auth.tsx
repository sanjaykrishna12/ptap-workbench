import { createContext, useContext, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, getToken, setToken, type Me } from './api';

export interface AuthConfig {
  mode: 'local' | 'cognito';
  domain?: string; client_id?: string; region?: string;
  personas?: { user_id: string; name: string; title: string; groups: string[] }[];
}

const MeContext = createContext<Me | null>(null);
export const useMe = () => {
  const me = useContext(MeContext);
  if (!me) throw new Error('useMe outside the signed-in app');
  return me;
};

export function MeProvider({ me, children }: { me: Me; children: ReactNode }) {
  return <MeContext.Provider value={me}>{children}</MeContext.Provider>;
}

export function useAuthConfig() {
  return useQuery({ queryKey: ['auth-config'], queryFn: () => api<AuthConfig>('/api/auth/config'), staleTime: Infinity });
}

export function useCurrentUser() {
  return useQuery({ queryKey: ['me'], queryFn: () => api<Me>('/api/me'), enabled: !!getToken(), staleTime: 60_000, retry: false });
}

// ---- Cognito Hosted UI, authorization code flow with PKCE
const VERIFIER = 'ptap.pkce';

function b64url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  arr.forEach(b => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function stash(key: string, value: string) { try { sessionStorage.setItem(key, value); } catch { (window as unknown as Record<string, string>)[key] = value; } }
function unstash(key: string): string | null {
  try { const v = sessionStorage.getItem(key); sessionStorage.removeItem(key); return v; } catch { return (window as unknown as Record<string, string>)[key] ?? null; }
}

export async function cognitoSignIn(cfg: AuthConfig) {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  stash(VERIFIER, verifier);
  const params = new URLSearchParams({
    response_type: 'code', client_id: cfg.client_id!, redirect_uri: `${location.origin}/auth/callback`,
    scope: 'openid email profile', code_challenge_method: 'S256', code_challenge: challenge,
  });
  location.assign(`https://${cfg.domain}/oauth2/authorize?${params}`);
}

export async function cognitoCallback(cfg: AuthConfig, code: string) {
  const verifier = unstash(VERIFIER);
  if (!verifier) throw new Error('Sign-in session expired; please sign in again.');
  const resp = await fetch(`https://${cfg.domain}/oauth2/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', client_id: cfg.client_id!, code,
      redirect_uri: `${location.origin}/auth/callback`, code_verifier: verifier }),
  });
  if (!resp.ok) throw new Error('Sign-in failed');
  const tokens = await resp.json();
  setToken(tokens.id_token);
}

export function signOut(cfg?: AuthConfig) {
  setToken(null);
  if (cfg?.mode === 'cognito' && cfg.domain) {
    location.assign(`https://${cfg.domain}/logout?client_id=${cfg.client_id}&logout_uri=${encodeURIComponent(location.origin + '/login')}`);
  } else {
    location.assign('/login');
  }
}
