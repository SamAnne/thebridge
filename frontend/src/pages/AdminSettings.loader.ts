import { redirect } from 'react-router-dom';

export interface Settings {
    id: number;
    hubName: string;
    contactEmail: string;
    defaultCounty: string | null;
    acceptingSubmissions: boolean;
}

interface CurrentUser {
    email: string;
    role: string;
}

interface MeResult {
    error?: string;
    email?: string;
    role?: string;
}

interface FetchJsonResult<T> {
    ok: boolean;
    data: T;
}

async function fetchJson<T>(url: string): Promise<FetchJsonResult<T> | null> {
    try {
        const response = await fetch(url, { credentials: 'include' });
        const data = await response.json();
        return { ok: response.ok, data };
    } catch {
        return null;
    }
}

function fallbackUser(meResult: FetchJsonResult<MeResult> | null): CurrentUser {
    const me = meResult?.data;
    if (meResult?.ok && me && !me.error && typeof me.email === 'string' && typeof me.role === 'string') {
        return { email: me.email, role: me.role };
    }
    return { email: 'Signed in', role: 'admin' };
}

// Same pattern as AdminResources/AdminUsers: /api/me and /api/settings are
// fetched concurrently, and GET /api/settings (admin-only server-side) is
// the authoritative check for whether this page renders.
export async function loader() {
    const [meResult, settingsResult] = await Promise.all([
        fetchJson<MeResult>('http://localhost:5000/api/me'),
        fetchJson<Settings | { error: string }>('http://localhost:5000/api/settings'),
    ]);

    const settingsData = settingsResult?.data;
    const settingsRejected = settingsResult?.ok && settingsData && 'error' in settingsData;
    if (settingsRejected) {
        throw redirect('/Login');
    }
    if (!settingsResult || !settingsResult.ok || !settingsData || !('id' in settingsData)) {
        return { settings: null, error: 'Could not load settings.', currentUser: fallbackUser(meResult) };
    }

    return { settings: settingsData as Settings, error: null, currentUser: fallbackUser(meResult) };
}
