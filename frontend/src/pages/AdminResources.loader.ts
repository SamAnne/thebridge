import { redirect } from 'react-router-dom';

export interface ResourceFile {
    id: number;
    url: string;
    fileName: string;
}

export interface AdminResource {
    id: number;
    description: string;
    status: string;
    published: boolean;
    counties: string[];
    districts: string[];
    note: string;
    date: string;
    updatedAt: string;
    files: ResourceFile[];
    user: { id: number; email: string };
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
    // Rare race: the data endpoint (authoritative, checked below) granted
    // access but /api/me didn't resolve usefully. Degrade the header
    // display gracefully rather than failing the page - access was already
    // confirmed by the real protected endpoint.
    return { email: 'Signed in', role: 'admin' };
}

// /api/me and /api/resources are fetched concurrently rather than gating
// one behind the other. GET /api/resources is admin-only server-side and
// re-verifies the session on every request, so it is the authoritative
// check for whether this page is allowed to render - /api/me is only used
// for the header's identity display, never for the access decision.
export async function loader() {
    const [meResult, resourcesResult] = await Promise.all([
        fetchJson<MeResult>('http://localhost:5000/api/me'),
        fetchJson<AdminResource[] | { error: string }>('http://localhost:5000/api/resources'),
    ]);

    // This backend's auth middleware always responds 200 with { error }
    // (see routes/roles.ts) - that specific shape is the authoritative
    // "you don't belong here" signal, matching the previous redirect
    // behavior, just now sourced from the real protected endpoint. A
    // non-2xx status or unreachable backend is a different, genuine
    // failure and gets the in-page error treatment instead.
    const resourcesData = resourcesResult?.data;
    const resourcesRejected = resourcesResult?.ok && resourcesData && !Array.isArray(resourcesData) && 'error' in resourcesData;
    if (resourcesRejected) {
        throw redirect('/Login');
    }
    if (!resourcesResult || !resourcesResult.ok || !Array.isArray(resourcesData)) {
        return { resources: [] as AdminResource[], error: 'Could not load resources.', currentUser: fallbackUser(meResult) };
    }

    return { resources: resourcesData, error: null, currentUser: fallbackUser(meResult) };
}
