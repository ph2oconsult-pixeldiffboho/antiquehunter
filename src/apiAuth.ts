// Client side of the API guard: attaches `Authorization: Bearer <Firebase ID token>` (when signed in) and
// `X-Firebase-AppCheck` (when App Check is configured) to same-origin /api/* requests.
// Done as a fetch wrapper so call sites in held files (src/services/gemini.ts → /api/comps, /api/appraise)
// are covered without editing them. Never blocks a request: token errors just mean the header is omitted.
import type { Auth } from 'firebase/auth';
import { getToken, type AppCheck } from 'firebase/app-check';

function isOwnApi(input: RequestInfo | URL): boolean {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const u = new URL(raw, window.location.href);
    return u.origin === window.location.origin && u.pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

export function installApiAuthFetch(auth: Auth, getAppCheck: () => AppCheck | null) {
  if (typeof window === 'undefined' || (window.fetch as any).__apiAuth) return;
  const original = window.fetch.bind(window);
  const wrapped = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isOwnApi(input)) return original(input, init);
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    try {
      const user = auth.currentUser;
      if (user && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
    } catch { /* signed-out or token refresh failed: send without */ }
    try {
      const ac = getAppCheck();
      if (ac && !headers.has('X-Firebase-AppCheck')) headers.set('X-Firebase-AppCheck', (await getToken(ac, false)).token);
    } catch { /* App Check not ready: send without */ }
    return original(input, { ...init, headers });
  };
  (wrapped as any).__apiAuth = true;
  window.fetch = wrapped as typeof fetch;
}
