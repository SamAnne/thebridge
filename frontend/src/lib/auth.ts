import { redirect } from 'react-router-dom';

export interface AuthUser {
    id: number;
    email: string;
    role: string;
}

// Loader-level RBAC guard: fetches the current session and redirects to
// /Login if it's missing/invalid or the role isn't in allowedRoles.
// Call with no roles to just require any authenticated session.
export async function requireRole(...allowedRoles: string[]): Promise<AuthUser> {
    let data: any;
    try {
        const response = await fetch('http://localhost:5000/api/me', {
            credentials: 'include'
        });
        data = await response.json();
    } catch {
        throw redirect('/Login');
    }

    if (data.error || !data.role) {
        throw redirect('/Login');
    }
    if (allowedRoles.length > 0 && !allowedRoles.includes(data.role)) {
        throw redirect('/Login');
    }

    return data as AuthUser;
}
