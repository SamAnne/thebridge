import { requireRole } from '../lib/auth';

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

export async function loader() {
    await requireRole('admin');
    try {
        const response = await fetch('http://localhost:5000/api/resources', {
            credentials: 'include',
        });
        if (!response.ok) {
            return { resources: [] as AdminResource[], error: 'Could not load resources.' };
        }
        const data = await response.json();
        if (data && data.error) {
            return { resources: [] as AdminResource[], error: data.error as string };
        }
        return { resources: data as AdminResource[], error: null };
    } catch {
        return { resources: [] as AdminResource[], error: 'Could not load resources.' };
    }
}
