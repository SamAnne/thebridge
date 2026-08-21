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
                { id: 1, email: 'admin@example.com', district: null, county: null, createdAt: '2026-08-21T17:00:10.961Z', role: { role: 'admin' } },
                { id: 2, email: 'counselor@example.com', district: 'North District', county: 'Fairfax', createdAt: '2026-08-20T10:00:00.000Z', role: { role: 'counselor' } },
            ]),
        })
    );

    await page.goto('/Admin/Users');

    await expect(page).toHaveURL(/\/Admin\/Users$/);
    await expect(page.getByRole('cell', { name: 'admin@example.com' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'counselor@example.com' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'North District' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Fairfax' })).toBeVisible();
});
