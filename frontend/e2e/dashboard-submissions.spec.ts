import { test, expect } from '@playwright/test';

// Covers only what's needed for the Platform Settings "accept resource
// submissions" toggle to be visible on the counselor's Dashboard - not an
// expansion of the counselor dashboard beyond that.

test('counselor sees the submit form when submissions are open', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 2, email: 'counselor@example.com', role: 'counselor' }) })
    );
    await page.route('http://localhost:5000/api/resources/unseen', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Not allowed with current role.' }) })
    );
    await page.route('http://localhost:5000/api/settings', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, hubName: 'The Bridge', contactEmail: 'hub@example.com', defaultCounty: null, acceptingSubmissions: true }) })
    );

    await page.goto('/Dashboard');

    await expect(page.getByLabel('Description')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit Resource' })).toBeVisible();
    await expect(page.getByText('Submissions are currently closed.')).not.toBeVisible();
});

test('counselor sees a closed message instead of the form when submissions are disabled', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 2, email: 'counselor@example.com', role: 'counselor' }) })
    );
    await page.route('http://localhost:5000/api/resources/unseen', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Not allowed with current role.' }) })
    );
    await page.route('http://localhost:5000/api/settings', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, hubName: 'The Bridge', contactEmail: 'hub@example.com', defaultCounty: null, acceptingSubmissions: false }) })
    );

    await page.goto('/Dashboard');

    await expect(page.getByText('Submissions are currently closed.')).toBeVisible();
    await expect(page.getByLabel('Description')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit Resource' })).not.toBeVisible();
});

test('a submission attempt rejected server-side (race between load and submit) shows the real error', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 2, email: 'counselor@example.com', role: 'counselor' }) })
    );
    await page.route('http://localhost:5000/api/resources/unseen', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ error: 'Not allowed with current role.' }) })
    );
    await page.route('http://localhost:5000/api/settings', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, hubName: 'The Bridge', contactEmail: 'hub@example.com', defaultCounty: null, acceptingSubmissions: true }) })
    );
    await page.route('http://localhost:5000/api/resources', route =>
        route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Resource submissions are currently closed.' }) })
    );

    await page.goto('/Dashboard');
    await page.getByLabel('Description').fill('Submitted right as it closed');
    await page.getByRole('button', { name: 'Submit Resource' }).click();

    await expect(page.getByText('Resource submissions are currently closed.')).toBeVisible();
});
