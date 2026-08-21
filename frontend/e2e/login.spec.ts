import { test, expect } from '@playwright/test';

// Login.tsx posts to a hardcoded http://localhost:5000/login, so these
// tests intercept that request rather than relying on a live backend.

test('failed login stays on /Login and shows the error', async ({ page }) => {
    await page.route('http://localhost:5000/login', route =>
        route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Server error' }) })
    );

    await page.goto('/Login');
    await page.fill('input[type="email"]', 'counselor@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/Login$/);
    await expect(page.getByText('Server error')).toBeVisible();
});

test('successful login navigates to /Dashboard', async ({ page }) => {
    await page.route('http://localhost:5000/login', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    );
    // Dashboard's loader requires a role too; give it one so navigation completes.
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 2, email: 'counselor@example.com', role: 'counselor' }) })
    );

    await page.goto('/Login');
    await page.fill('input[type="email"]', 'counselor@example.com');
    await page.fill('input[type="password"]', 'counselorpassword123');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/Dashboard$/);
});
