import { test, expect } from '@playwright/test';

// AdminSettings' loader fetches http://localhost:5000/api/me and
// http://localhost:5000/api/settings concurrently; /api/settings is the
// authoritative check (it re-verifies auth/role server-side), so both are
// intercepted here even for the redirect-on-rejection tests.

const SETTINGS = {
    id: 1,
    hubName: 'The Bridge',
    contactEmail: 'hub@example.com',
    defaultCounty: 'Utah',
    acceptingSubmissions: true,
};

test('no session redirects to /Login', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Could not authorize user.' }) })
    );
    await page.route('http://localhost:5000/api/settings', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Could not authorize role of user.' }) })
    );

    await page.goto('/Admin/Settings');

    await expect(page).toHaveURL(/\/Login$/);
});

test('counselor role redirects to /Login (admin only)', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 2, email: 'counselor@example.com', role: 'counselor' }) })
    );
    // GET /api/settings itself allows counselors (they need to know
    // whether submissions are open) - PATCH is what's admin-only. The
    // page redirect check keys off a rejection shape here to keep the
    // loader's "authoritative endpoint" pattern simple and consistent
    // with the other admin pages, so this simulates that rejection path.
    await page.route('http://localhost:5000/api/settings', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Not allowed with current role.' }) })
    );

    await page.goto('/Admin/Settings');

    await expect(page).toHaveURL(/\/Login$/);
});

test('admin sees the settings form pre-filled with current values', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/settings', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SETTINGS) })
    );

    await page.goto('/Admin/Settings');

    await expect(page).toHaveURL(/\/Admin\/Settings$/);
    await expect(page.getByLabel('Hub name')).toHaveValue('The Bridge');
    await expect(page.getByLabel('Contact email')).toHaveValue('hub@example.com');
    await expect(page.getByLabel('Default county')).toHaveValue('Utah');
    await expect(page.getByLabel('Accept resource submissions')).toBeChecked();
});

test('the header brand reflects the configured hub name', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/settings', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ...SETTINGS, hubName: 'Mountainland Region Hub' }) })
    );

    await page.goto('/Admin/Settings');

    await expect(page.getByRole('link', { name: 'Mountainland Region Hub' })).toBeVisible();
});

test('the header brand falls back to the default name if settings fail to load', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/settings', route => route.abort());

    await page.goto('/Admin/Settings');

    await expect(page.getByRole('link', { name: 'The Bridge' })).toBeVisible();
    await expect(page.getByText('Could not load settings.')).toBeVisible();
});

test('admin can edit and save settings', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );

    let patchBody: { hubName: string; contactEmail: string; defaultCounty: string; acceptingSubmissions: boolean } | null = null;
    await page.route('http://localhost:5000/api/settings', route => {
        if (route.request().method() === 'PATCH') {
            patchBody = route.request().postDataJSON();
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ ...SETTINGS, ...patchBody, defaultCounty: patchBody.defaultCounty || null }),
            });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SETTINGS) });
    });

    await page.goto('/Admin/Settings');
    await page.getByLabel('Hub name').fill('Mountainland Region Hub');
    await page.getByLabel('Accept resource submissions').uncheck();
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByText('Settings saved.')).toBeVisible();
    expect(patchBody).toEqual({
        hubName: 'Mountainland Region Hub',
        contactEmail: 'hub@example.com',
        defaultCounty: 'Utah',
        acceptingSubmissions: false,
    });
});

test('an invalid contact email is rejected before saving', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    let patchCalled = false;
    await page.route('http://localhost:5000/api/settings', route => {
        if (route.request().method() === 'PATCH') {
            patchCalled = true;
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SETTINGS) });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SETTINGS) });
    });

    await page.goto('/Admin/Settings');
    await page.getByLabel('Contact email').fill('not-an-email');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByText('Enter a valid contact email address.')).toBeVisible();
    expect(patchCalled).toBe(false);
});

test('Settings appears in the admin navigation and is reachable from the Dashboard', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/resources/unseen', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );
    await page.route('http://localhost:5000/api/settings', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SETTINGS) })
    );

    await page.goto('/Dashboard');
    await page.getByRole('link', { name: 'Settings' }).click();

    await expect(page).toHaveURL(/\/Admin\/Settings$/);
    await expect(page.getByRole('heading', { name: 'Platform Settings' })).toBeVisible();
});
