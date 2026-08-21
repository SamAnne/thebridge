import { test, expect } from '@playwright/test';

// AdminUsers' loader calls requireRole('admin') then fetches
// http://localhost:5000/api/users. Both calls are intercepted here.

test('no session redirects to /Login', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Could not authorize user.' }) })
    );

    await page.goto('/Admin/Users');

    await expect(page).toHaveURL(/\/Login$/);
});

test('counselor role redirects to /Login (admin only)', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 2, email: 'counselor@example.com', role: 'counselor' }) })
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
