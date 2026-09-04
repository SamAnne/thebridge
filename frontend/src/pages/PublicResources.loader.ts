import type { LoaderFunctionArgs } from 'react-router-dom';

export interface PublicResourceFile {
    id: number;
    url: string;
    fileName: string;
}

export interface PublicResource {
    id: number;
    description: string;
    counties: string[];
    districts: string[];
    date: string;
    updatedAt: string;
    files: PublicResourceFile[];
}

// No county/district selector exists in the app yet (see the Phase report),
// so there's nothing to send by default. Reading ?county=/&district= from
// the URL keeps the public API's filtering usable and testable today,
// without inventing a selector UI.
export async function loader({ request }: LoaderFunctionArgs) {
    const requestUrl = new URL(request.url);
    const county = requestUrl.searchParams.get('county');
    const district = requestUrl.searchParams.get('district');

    const apiParams = new URLSearchParams();
    if (county) apiParams.set('county', county);
    if (district) apiParams.set('district', district);
    const query = apiParams.toString();

    try {
        const response = await fetch(`http://localhost:5000/api/resources/public${query ? `?${query}` : ''}`);
        if (!response.ok) {
            return { resources: [] as PublicResource[], error: 'Could not load resources.', filtered: Boolean(query) };
        }
        const data = await response.json();
        return { resources: data as PublicResource[], error: null, filtered: Boolean(query) };
    } catch {
        return { resources: [] as PublicResource[], error: 'Could not load resources.', filtered: Boolean(query) };
    }
}
