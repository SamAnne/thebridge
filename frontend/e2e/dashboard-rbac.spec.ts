import { test, expect } from '@playwright/test';

// Dashboard's loader calls requireRole('admin', 'counselor') from
// src/lib/auth.ts, which fetches http://localhost:5000/api/me. These
// tests intercept that call to exercise every branch of the guard.

test('no session redirects to /Login', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Could not authorize user.' }) })
    );

    await page.goto('/Dashboard');

    await expect(page).toHaveURL(/\/Login$/);
});

test('a role outside the allow-list redirects to /Login', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 5, email: 'student@example.com', role: 'student' }) })
    );

    await page.goto('/Dashboard');

    await expect(page).toHaveURL(/\/Login$/);
});

test('admin role reaches the Dashboard and sees the review queue', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/resources/unseen', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );

    await page.goto('/Dashboard');

    await expect(page).toHaveURL(/\/Dashboard$/);
    await expect(page.getByRole('heading', { name: 'Review Queue' })).toBeVisible();
});

test('counselor role reaches the Dashboard and sees the submit form', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 2, email: 'counselor@example.com', role: 'counselor' }) })
    );

    await page.goto('/Dashboard');

    await expect(page).toHaveURL(/\/Dashboard$/);
    await expect(page.getByText('Submit a Resource')).toBeVisible();
});
