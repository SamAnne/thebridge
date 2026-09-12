import { test, expect } from '@playwright/test';

// AdminUsers' loader fetches http://localhost:5000/api/me and
// http://localhost:5000/api/users concurrently; /api/users is the
// authoritative check (it re-verifies auth/role server-side), so both are
// intercepted here even for the redirect-on-rejection tests.

// AppHeader also fetches /api/settings on mount (for the hub name shown in
// the brand link) - stubbed for every test here so the suite stays hermetic
// instead of falling through to a live backend.
test.beforeEach(async ({ page }) => {
    await page.route('http://localhost:5000/api/settings', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, hubName: 'The Bridge', contactEmail: '', defaultCounty: null, acceptingSubmissions: true }) })
    );
});

test('no session redirects to /Login', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Could not authorize user.' }) })
    );
    await page.route('http://localhost:5000/api/users', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Could not authorize role of user.' }) })
    );

    await page.goto('/Admin/Users');

    await expect(page).toHaveURL(/\/Login$/);
});

test('counselor role redirects to /Login (admin only)', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 2, email: 'counselor@example.com', role: 'counselor' }) })
    );
    await page.route('http://localhost:5000/api/users', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Not allowed with current role.' }) })
    );

    await page.goto('/Admin/Users');

    await expect(page).toHaveURL(/\/Login$/);
});

test('admin sees the registered users table', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/users', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                { id: 1, name: 'Admin User', email: 'admin@example.com', district: null, county: null, createdAt: '2026-08-21T17:00:10.961Z', role: { role: 'admin' } },
                { id: 2, name: 'Jordan Casey', email: 'counselor@example.com', district: 'North District', county: 'Fairfax', createdAt: '2026-08-20T10:00:00.000Z', role: { role: 'counselor' } },
            ]),
        })
    );

    await page.goto('/Admin/Users');

    await expect(page).toHaveURL(/\/Admin\/Users$/);
    await expect(page.getByRole('cell', { name: 'Admin User' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Jordan Casey' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'admin@example.com' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'counselor@example.com' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'North District' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Fairfax' })).toBeVisible();
});

test('search filters by name/email/district/county, and role dropdown filters by role', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/users', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                { id: 1, name: 'Admin User', email: 'admin@example.com', district: null, county: null, createdAt: '2026-08-21T17:00:10.961Z', role: { role: 'admin' } },
                { id: 2, name: 'Jordan Casey', email: 'counselor@example.com', district: 'North District', county: 'Fairfax', createdAt: '2026-08-20T10:00:00.000Z', role: { role: 'counselor' } },
                { id: 3, name: 'Sam Rivera', email: 'sam.rivera@example.com', district: 'South District', county: 'Wasatch', createdAt: '2026-08-19T10:00:00.000Z', role: { role: 'counselor' } },
            ]),
        })
    );

    await page.goto('/Admin/Users');
    await expect(page.getByText('3 accounts')).toBeVisible();

    // Search narrows to matching rows across name/email/district/county
    await page.getByPlaceholder('Search by name, email, district, or county...').fill('wasatch');
    await expect(page.getByText('1 of 3 accounts')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Sam Rivera' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Jordan Casey' })).not.toBeVisible();

    // Clear search, use role dropdown instead
    await page.getByPlaceholder('Search by name, email, district, or county...').fill('');
    await page.getByLabel('Filter by role').selectOption('counselor');
    await expect(page.getByText('2 of 3 accounts')).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Admin User' })).not.toBeVisible();

    // Combine search + role filter down to zero results -> empty state
    await page.getByPlaceholder('Search by name, email, district, or county...').fill('nonexistent');
    await expect(page.getByText('No users match your search.')).toBeVisible();
});

test('editing a user saves via PATCH and updates the row', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/users', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                { id: 2, name: 'Jordan Casey', email: 'counselor@example.com', district: null, county: null, createdAt: '2026-08-20T10:00:00.000Z', role: { role: 'counselor' } },
            ]),
        })
    );
    let patchBody: any = null;
    await page.route('http://localhost:5000/api/users/2', route => {
        patchBody = route.request().postDataJSON();
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ id: 2, name: 'Jordan Casey', email: 'counselor@example.com', district: 'North District', county: 'Fairfax', createdAt: '2026-08-20T10:00:00.000Z', role: { role: 'counselor' } }),
        });
    });

    await page.goto('/Admin/Users');
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('District').fill('North District');
    await page.getByLabel('County').fill('Fairfax');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('cell', { name: 'North District' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Fairfax' })).toBeVisible();
    expect(patchBody).toEqual({ name: 'Jordan Casey', district: 'North District', county: 'Fairfax', role: 'counselor' });
    // back to view mode - Edit button reappears, no stray Save/Cancel left behind
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
});

test('cancelling an edit discards changes', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/users', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                { id: 2, name: 'Jordan Casey', email: 'counselor@example.com', district: null, county: null, createdAt: '2026-08-20T10:00:00.000Z', role: { role: 'counselor' } },
            ]),
        })
    );

    await page.goto('/Admin/Users');
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('District').fill('Should not be saved');
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page.getByRole('cell', { name: 'Should not be saved' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
});

test('editing another user shows a role dropdown and sends the new role', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/users', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                { id: 2, name: 'Jordan Casey', email: 'counselor@example.com', district: null, county: null, createdAt: '2026-08-20T10:00:00.000Z', role: { role: 'counselor' } },
            ]),
        })
    );
    let patchBody: any = null;
    await page.route('http://localhost:5000/api/users/2', route => {
        patchBody = route.request().postDataJSON();
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ id: 2, name: 'Jordan Casey', email: 'counselor@example.com', district: null, county: null, createdAt: '2026-08-20T10:00:00.000Z', role: { role: 'admin' } }),
        });
    });

    await page.goto('/Admin/Users');
    await page.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Role', { exact: true }).selectOption('admin');
    await page.getByRole('button', { name: 'Save' }).click();

    expect(patchBody.role).toBe('admin');
    await expect(page.getByRole('cell', { name: 'admin', exact: true })).toBeVisible();
});

test('editing your own row shows role as read-only and omits role from the save', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/users', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                { id: 1, name: 'Admin User', email: 'admin@example.com', district: null, county: null, createdAt: '2026-08-20T10:00:00.000Z', role: { role: 'admin' } },
            ]),
        })
    );
    let patchBody: any = null;
    await page.route('http://localhost:5000/api/users/1', route => {
        patchBody = route.request().postDataJSON();
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ id: 1, name: 'Admin User', email: 'admin@example.com', district: 'Central', county: null, createdAt: '2026-08-20T10:00:00.000Z', role: { role: 'admin' } }),
        });
    });

    await page.goto('/Admin/Users');
    await page.getByRole('button', { name: 'Edit' }).click();

    // no role dropdown for your own row
    await expect(page.getByLabel('Role', { exact: true })).not.toBeVisible();

    await page.getByLabel('District').fill('Central');
    await page.getByRole('button', { name: 'Save' }).click();

    expect(patchBody).not.toHaveProperty('role');
});

test('disabling another user shows a Disabled badge and flips the button to Enable', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/users', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                { id: 2, name: 'Jordan Casey', email: 'counselor@example.com', district: null, county: null, active: true, createdAt: '2026-08-20T10:00:00.000Z', role: { role: 'counselor' } },
            ]),
        })
    );
    let patchBody: any = null;
    await page.route('http://localhost:5000/api/users/2', route => {
        patchBody = route.request().postDataJSON();
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ id: 2, name: 'Jordan Casey', email: 'counselor@example.com', district: null, county: null, active: false, createdAt: '2026-08-20T10:00:00.000Z', role: { role: 'counselor' } }),
        });
    });

    await page.goto('/Admin/Users');
    await page.getByRole('button', { name: 'Disable' }).click();

    expect(patchBody).toEqual({ active: false });
    await expect(page.getByText('Disabled')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Enable' })).toBeVisible();
});

test('there is no Disable/Enable button on your own row', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/users', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                { id: 1, name: 'Admin User', email: 'admin@example.com', district: null, county: null, active: true, createdAt: '2026-08-20T10:00:00.000Z', role: { role: 'admin' } },
            ]),
        })
    );

    await page.goto('/Admin/Users');

    await expect(page.getByRole('button', { name: 'Disable' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Enable' })).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
});
