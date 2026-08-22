import { test, expect } from '@playwright/test';

test('clicking Logout on the Dashboard calls /logout and redirects to /Login', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 2, email: 'counselor@example.com', role: 'counselor' }) })
    );
    let logoutCalled = false;
    await page.route('http://localhost:5000/logout', route => {
        logoutCalled = true;
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
    });

    await page.goto('/Dashboard');
    await page.getByRole('button', { name: 'Logout' }).click();

    await expect(page).toHaveURL(/\/Login$/);
    expect(logoutCalled).toBe(true);
});

test('clicking Logout on the Admin Users page also redirects to /Login', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/users', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) })
    );
    await page.route('http://localhost:5000/logout', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    );

    await page.goto('/Admin/Users');
    await page.getByRole('button', { name: 'Logout' }).click();

    await expect(page).toHaveURL(/\/Login$/);
});
