import { test, expect } from '@playwright/test';

// AdminResources' loader fetches http://localhost:5000/api/me and
// http://localhost:5000/api/resources concurrently; /api/resources is the
// authoritative check (it re-verifies auth/role server-side), so both are
// intercepted here even for the redirect-on-rejection tests.

const BASE_RESOURCE = {
    id: 1,
    description: 'A guide to FAFSA deadlines for the upcoming school year.',
    status: 'approved',
    published: true,
    counties: ['Utah'],
    districts: ['Alpine School District'],
    note: 'looks good',
    date: '2026-08-20T10:00:00.000Z',
    updatedAt: '2026-08-21T10:00:00.000Z',
    files: [{ id: 1, url: 'https://example.com/fafsa.pdf', fileName: 'fafsa-guide.pdf' }],
    user: { id: 2, email: 'counselor@example.com' },
};

test('no session redirects to /Login', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Could not authorize user.' }) })
    );
    await page.route('http://localhost:5000/api/resources', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Could not authorize role of user.' }) })
    );

    await page.goto('/Admin/Resources');

    await expect(page).toHaveURL(/\/Login$/);
});

test('counselor role redirects to /Login (admin only)', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 2, email: 'counselor@example.com', role: 'counselor' }) })
    );
    await page.route('http://localhost:5000/api/resources', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Not allowed with current role.' }) })
    );

    await page.goto('/Admin/Resources');

    await expect(page).toHaveURL(/\/Login$/);
});

test('admin sees the resource list with review status and publication state', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/resources', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([BASE_RESOURCE]) })
    );

    await page.goto('/Admin/Resources');

    await expect(page).toHaveURL(/\/Admin\/Resources$/);
    await expect(page.getByText('A guide to FAFSA deadlines', { exact: false })).toBeVisible();
    await expect(page.locator('.review-status-pill')).toHaveText('Approved');
    await expect(page.locator('.publication-pill')).toHaveText('Published');
    await expect(page.getByText('Utah')).toBeVisible();
    await expect(page.getByText('Alpine School District')).toBeVisible();
    await expect(page.getByRole('link', { name: 'fafsa-guide.pdf' })).toBeVisible();
});

test('empty result shows the empty state, not a blank page', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/resources', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );

    await page.goto('/Admin/Resources');

    await expect(page.getByText('No resources yet.')).toBeVisible();
});

test('API failure shows an error message instead of a blank/broken page', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/resources', route =>
        route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server error' }) })
    );

    await page.goto('/Admin/Resources');

    await expect(page.getByText('Could not load resources.')).toBeVisible();
});

test('search and filters narrow the list', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/resources', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                BASE_RESOURCE,
                { ...BASE_RESOURCE, id: 2, description: 'Scholarship application checklist.', status: 'unseen', published: false, counties: [], districts: [], files: [] },
            ]),
        })
    );

    await page.goto('/Admin/Resources');
    await expect(page.getByText('2 resources')).toBeVisible();

    await page.getByLabel('Search resources').fill('scholarship');
    await expect(page.getByText('1 of 2 resources')).toBeVisible();
    await expect(page.getByText('Scholarship application checklist.')).toBeVisible();
    await expect(page.getByText('A guide to FAFSA deadlines', { exact: false })).not.toBeVisible();

    await page.getByLabel('Search resources').fill('');
    await page.getByLabel('Filter by publication state').selectOption('unpublished');
    await expect(page.getByText('1 of 2 resources')).toBeVisible();
    await expect(page.getByText('Region-wide')).toBeVisible();
});

test('editing description, counties, and districts saves via PATCH and updates the card', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/resources', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([BASE_RESOURCE]) })
    );
    let patchBody: any = null;
    await page.route('http://localhost:5000/api/resources/1', route => {
        patchBody = route.request().postDataJSON();
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
                ...BASE_RESOURCE,
                description: 'Updated FAFSA guide for next year.',
                counties: ['Utah', 'Wasatch'],
                districts: ['Alpine School District', 'Nebo School District'],
            }),
        });
    });

    await page.goto('/Admin/Resources');
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Description').fill('Updated FAFSA guide for next year.');
    await page.getByLabel('Counties (comma-separated)').fill('Utah, Wasatch');
    await page.getByLabel('Districts (comma-separated)').fill('Alpine School District, Nebo School District');
    await page.getByRole('button', { name: 'Save' }).click();

    expect(patchBody).toEqual({
        description: 'Updated FAFSA guide for next year.',
        counties: ['Utah', 'Wasatch'],
        districts: ['Alpine School District', 'Nebo School District'],
    });
    await expect(page.getByText('Updated FAFSA guide for next year.')).toBeVisible();
    await expect(page.getByText('Wasatch')).toBeVisible();
    await expect(page.getByText('Nebo School District')).toBeVisible();
    // back to view mode
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
});

test('changes persist after a page reload', async ({ page }) => {
    let currentDescription = BASE_RESOURCE.description;
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/resources', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ ...BASE_RESOURCE, description: currentDescription }]) })
    );
    await page.route('http://localhost:5000/api/resources/1', route => {
        currentDescription = 'Persisted after reload.';
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...BASE_RESOURCE, description: currentDescription }) });
    });

    await page.goto('/Admin/Resources');
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Description').fill('Persisted after reload.');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Persisted after reload.')).toBeVisible();

    await page.reload();
    await expect(page.getByText('Persisted after reload.')).toBeVisible();
});

test('an approved+unpublished resource can be published', async ({ page }) => {
    const unpublished = { ...BASE_RESOURCE, published: false };
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/resources', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([unpublished]) })
    );
    await page.route('http://localhost:5000/api/resources/1/publish', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...unpublished, published: true }) })
    );

    await page.goto('/Admin/Resources');
    await expect(page.getByText('Unpublished', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Publish' }).click();

    await expect(page.getByText('Published', { exact: true })).toBeVisible();
});

test('a published resource requires confirmation before unpublishing', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/resources', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([BASE_RESOURCE]) })
    );
    let unpublishCalled = false;
    await page.route('http://localhost:5000/api/resources/1/unpublish', route => {
        unpublishCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...BASE_RESOURCE, published: false }) });
    });

    await page.goto('/Admin/Resources');
    await page.getByRole('button', { name: 'Unpublish', exact: true }).click();

    // confirmation text shown, no API call yet
    await expect(page.getByText('Unpublish this resource?', { exact: false })).toBeVisible();
    expect(unpublishCalled).toBe(false);

    // cancelling does not call the API
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Unpublish this resource?', { exact: false })).not.toBeVisible();
    expect(unpublishCalled).toBe(false);

    // confirming does
    await page.getByRole('button', { name: 'Unpublish', exact: true }).click();
    await page.getByRole('button', { name: 'Yes, unpublish' }).click();

    expect(unpublishCalled).toBe(true);
    await expect(page.getByText('Unpublished', { exact: true })).toBeVisible();
});

test('a non-approved resource shows a disabled Publish action instead of allowing the call', async ({ page }) => {
    const unseenResource = { ...BASE_RESOURCE, status: 'unseen', published: false };
    let publishCalled = false;
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/resources', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([unseenResource]) })
    );
    await page.route('http://localhost:5000/api/resources/1/publish', route => {
        publishCalled = true;
        route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'Only approved resources can be published.' }) });
    });

    await page.goto('/Admin/Resources');

    await expect(page.getByRole('button', { name: 'Publish' })).toBeDisabled();
    await expect(page.getByText('Only approved resources can be published.')).toBeVisible();
    expect(publishCalled).toBe(false);
});

test('a publish API failure is shown inline', async ({ page }) => {
    const approvedUnpublished = { ...BASE_RESOURCE, published: false };
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/resources', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([approvedUnpublished]) })
    );
    await page.route('http://localhost:5000/api/resources/1/publish', route =>
        route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server error' }) })
    );

    await page.goto('/Admin/Resources');
    await page.getByRole('button', { name: 'Publish' }).click();

    await expect(page.getByText('Server error')).toBeVisible();
    // publication state did not change on failure
    await expect(page.getByText('Unpublished', { exact: true })).toBeVisible();
});
