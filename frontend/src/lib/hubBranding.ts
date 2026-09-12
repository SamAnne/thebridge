export const FALLBACK_HUB_NAME = 'The Bridge';

// AppHeader renders on every authenticated page (Dashboard, all Admin/*
// pages), so a naive per-mount fetch would hit /api/settings on every
// navigation. Caching the resolved name at module scope means only the
// first AppHeader mount this session pays for the request - every
// subsequent navigation reuses the cached value with no network call.
let cachedHubName: string | null = null;
let pending: Promise<string> | null = null;

export function getHubName(): Promise<string> {
    if (cachedHubName !== null) return Promise.resolve(cachedHubName);
    if (pending) return pending;

    pending = fetch('http://localhost:5000/api/settings', { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
            const name = typeof data?.hubName === 'string' && data.hubName.trim() ? data.hubName : FALLBACK_HUB_NAME;
            cachedHubName = name;
            return name;
        })
        .catch(() => FALLBACK_HUB_NAME)
        .finally(() => {
            pending = null;
        });

    return pending;
}
