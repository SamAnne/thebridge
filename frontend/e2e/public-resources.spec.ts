import { test, expect } from '@playwright/test';

// PublicResources' loader fetches http://localhost:5000/api/resources/public
// and http://localhost:5000/api/settings/public (both no-auth) concurrently.
// These tests intercept both calls - same convention as the rest of the
// suite (backend calls mocked, no live server/DB needed). Default settings
// mock returns no contactEmail so existing assertions aren't affected by
// the contact line; the dedicated tests below override it.
test.beforeEach(async ({ page }) => {
    await page.route('http://localhost:5000/api/settings/public', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hubName: 'The Bridge', contactEmail: '' }) })
    );
});

const SAMPLE_RESOURCE = {
    id: 1,
    description: 'A guide to FAFSA deadlines for the upcoming school year.',
    counties: ['Utah'],
    districts: ['Alpine School District'],
    date: '2026-08-20T10:00:00.000Z',
    updatedAt: '2026-08-20T10:00:00.000Z',
    files: [{ id: 1, url: 'https://example.com/fafsa.pdf', fileName: 'fafsa-guide.pdf' }],
};

test('the public Resources page loads and renders real API data', async ({ page }) => {
    await page.route('http://localhost:5000/api/resources/public', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([SAMPLE_RESOURCE]) })
    );

    await page.goto('/Resources');

    await expect(page).toHaveURL(/\/Resources$/);
    await expect(page.getByRole('heading', { name: 'Resources' })).toBeVisible();
    await expect(page.getByText('A guide to FAFSA deadlines', { exact: false })).toBeVisible();
    await expect(page.getByText('Utah')).toBeVisible();
    await expect(page.getByText('Alpine School District')).toBeVisible();
    await expect(page.getByRole('link', { name: 'fafsa-guide.pdf' })).toBeVisible();
});

test('file links open safely in a new tab', async ({ page }) => {
    await page.route('http://localhost:5000/api/resources/public', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([SAMPLE_RESOURCE]) })
    );

    await page.goto('/Resources');

    const link = page.getByRole('link', { name: 'fafsa-guide.pdf' });
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
    await expect(link).toHaveAttribute('rel', /noreferrer/);
    await expect(link).toHaveAttribute('href', 'https://example.com/fafsa.pdf');
});

test('a PDF file can be previewed inline without leaving the page', async ({ page }) => {
    await page.route('http://localhost:5000/api/resources/public', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([SAMPLE_RESOURCE]) })
    );

    await page.goto('/Resources');

    const toggle = page.getByRole('button', { name: 'Preview' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByTitle('Preview of fafsa-guide.pdf')).toHaveCount(0);

    await toggle.click();

    await expect(toggle).toHaveText('Hide preview');
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const frame = page.getByTitle('Preview of fafsa-guide.pdf');
    await expect(frame).toBeVisible();
    await expect(frame).toHaveAttribute('src', 'https://example.com/fafsa.pdf#toolbar=0');

    await toggle.click();
    await expect(page.getByTitle('Preview of fafsa-guide.pdf')).toHaveCount(0);
});

test('a non-PDF file has no preview toggle, only the plain link', async ({ page }) => {
    await page.route('http://localhost:5000/api/resources/public', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([{
                ...SAMPLE_RESOURCE,
                files: [{ id: 2, url: 'https://example.com/notes.docx', fileName: 'notes.docx' }],
            }]),
        })
    );

    await page.goto('/Resources');

    await expect(page.getByRole('link', { name: 'notes.docx' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Preview' })).toHaveCount(0);
});

test('no published resources shows the empty state', async ({ page }) => {
    await page.route('http://localhost:5000/api/resources/public', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );

    await page.goto('/Resources');

    await expect(page.getByText('No published resources yet. Check back soon.')).toBeVisible();
});

test('API failure shows an error message instead of a blank/broken page', async ({ page }) => {
    await page.route('http://localhost:5000/api/resources/public', route =>
        route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server error' }) })
    );

    await page.goto('/Resources');

    await expect(page.getByText('Could not load resources.')).toBeVisible();
});

test('a resource with no county/district tags renders without a tags section', async ({ page }) => {
    await page.route('http://localhost:5000/api/resources/public', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([{ ...SAMPLE_RESOURCE, counties: [], districts: [] }]),
        })
    );

    await page.goto('/Resources');

    await expect(page.getByText('A guide to FAFSA deadlines', { exact: false })).toBeVisible();
    await expect(page.getByText('Utah')).not.toBeVisible();
});

test('the Home page links to the public Resources page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Browse Resources' }).click();
    await expect(page).toHaveURL(/\/Resources$/);
});

test('?county and ?district in the URL are forwarded as query params to the public API', async ({ page }) => {
    let requestedUrl = '';
    await page.route('http://localhost:5000/api/resources/public*', route => {
        requestedUrl = route.request().url();
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([SAMPLE_RESOURCE]) });
    });

    await page.goto('/Resources?county=Utah&district=Alpine%20School%20District');

    await expect(page.getByText('A guide to FAFSA deadlines', { exact: false })).toBeVisible();
    const requestUrl = new URL(requestedUrl);
    expect(requestUrl.searchParams.get('county')).toBe('Utah');
    expect(requestUrl.searchParams.get('district')).toBe('Alpine School District');
});

test('an empty filtered result shows the filtered empty state, not the generic one', async ({ page }) => {
    await page.route('http://localhost:5000/api/resources/public*', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );

    await page.goto('/Resources?county=Nonexistent');

    await expect(page.getByText('No resources match the selected filters.')).toBeVisible();
});

test('admin publishing a resource makes it appear on the public page', async ({ page }) => {
    const unpublished = { id: 1, description: 'Scholarship checklist.', status: 'approved', published: false, counties: [], districts: [], note: '', date: '2026-08-20T10:00:00.000Z', updatedAt: '2026-08-20T10:00:00.000Z', files: [], user: { id: 2, email: 'counselor@example.com' } };

    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/resources', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([unpublished]) })
    );
    await page.route('http://localhost:5000/api/settings', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, hubName: 'The Bridge', contactEmail: '', defaultCounty: null, acceptingSubmissions: true }) })
    );
    await page.route('http://localhost:5000/api/resources/1/publish', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...unpublished, published: true }) })
    );

    await page.goto('/Admin/Resources');
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page.locator('.publication-pill')).toHaveText('Published');

    // now the public API reflects the just-published resource
    await page.route('http://localhost:5000/api/resources/public', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([{ id: 1, description: 'Scholarship checklist.', counties: [], districts: [], date: unpublished.date, updatedAt: unpublished.updatedAt, files: [] }]),
        })
    );
    await page.goto('/Resources');

    await expect(page.getByText('Scholarship checklist.')).toBeVisible();
});

test('admin unpublishing a resource removes it from the public page', async ({ page }) => {
    const published = { id: 1, description: 'Scholarship checklist.', status: 'approved', published: true, counties: [], districts: [], note: '', date: '2026-08-20T10:00:00.000Z', updatedAt: '2026-08-20T10:00:00.000Z', files: [], user: { id: 2, email: 'counselor@example.com' } };

    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/resources', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([published]) })
    );
    await page.route('http://localhost:5000/api/settings', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, hubName: 'The Bridge', contactEmail: '', defaultCounty: null, acceptingSubmissions: true }) })
    );
    await page.route('http://localhost:5000/api/resources/1/unpublish', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...published, published: false }) })
    );

    await page.goto('/Admin/Resources');
    await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
    await page.getByRole('button', { name: 'Yes, unpublish' }).click();
    await expect(page.locator('.publication-pill')).toHaveText('Unpublished');

    // the public API no longer returns it once unpublished
    await page.route('http://localhost:5000/api/resources/public', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );
    await page.goto('/Resources');

    await expect(page.getByText('No published resources yet. Check back soon.')).toBeVisible();
});

test('a configured contact email renders as a mailto link', async ({ page }) => {
    await page.route('http://localhost:5000/api/settings/public', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hubName: 'The Bridge', contactEmail: 'hub@example.com' }) })
    );
    await page.route('http://localhost:5000/api/resources/public', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );

    await page.goto('/Resources');

    const link = page.getByRole('link', { name: 'hub@example.com' });
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', 'mailto:hub@example.com');
});

test('no configured contact email shows no contact line', async ({ page }) => {
    await page.route('http://localhost:5000/api/resources/public', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );

    await page.goto('/Resources');

    await expect(page.getByText('Questions?')).not.toBeVisible();
});
