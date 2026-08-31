import { test, expect } from '@playwright/test';

// Dashboard's loader fetches http://localhost:5000/api/me and
// http://localhost:5000/api/resources/unseen concurrently (the second is
// fired regardless of role - an admin-only endpoint rejects a counselor
// fast, which is fine since /api/me stays the authoritative redirect
// check here). Both calls are intercepted in every test below.

test('no session redirects to /Login', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Could not authorize user.' }) })
    );
    await page.route('http://localhost:5000/api/resources/unseen', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Could not authorize role of user.' }) })
    );

    await page.goto('/Dashboard');

    await expect(page).toHaveURL(/\/Login$/);
});

test('a role outside the allow-list redirects to /Login', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 5, email: 'student@example.com', role: 'student' }) })
    );
    await page.route('http://localhost:5000/api/resources/unseen', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Not allowed with current role.' }) })
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

test('admin can navigate to the Registered Users page from the Dashboard link', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/resources/unseen', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );
    await page.route('http://localhost:5000/api/users', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );

    await page.goto('/Dashboard');
    await page.getByRole('link', { name: 'Users' }).click();

    await expect(page).toHaveURL(/\/Admin\/Users$/);
    await expect(page.getByRole('heading', { name: 'Registered Users' })).toBeVisible();
});

test('admin can navigate to the Resource Management page from the Dashboard link', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/resources/unseen', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );
    await page.route('http://localhost:5000/api/resources', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );

    await page.goto('/Dashboard');
    await page.getByRole('link', { name: 'Resources' }).click();

    await expect(page).toHaveURL(/\/Admin\/Resources$/);
    await expect(page.getByRole('heading', { name: 'Resource Management' })).toBeVisible();
});

test('counselor role reaches the Dashboard and sees the submit form', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 2, email: 'counselor@example.com', role: 'counselor' }) })
    );
    await page.route('http://localhost:5000/api/resources/unseen', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Not allowed with current role.' }) })
    );

    await page.goto('/Dashboard');

    await expect(page).toHaveURL(/\/Dashboard$/);
    await expect(page.getByText('Submit a Resource')).toBeVisible();
});
