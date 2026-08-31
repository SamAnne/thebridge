import { test, expect } from '@playwright/test';

// Regression test for a shared-ref bug: the review queue's note input used
// to be backed by a single useRef reused across every rendered card, so it
// only ever pointed at whichever card's input was rendered last. Approving
// or rejecting any *other* card would silently submit that last card's note
// instead of its own.

test('a note typed on one resource is not submitted for a different resource', async ({ page }) => {
    await page.route('http://localhost:5000/api/me', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, email: 'admin@example.com', role: 'admin' }) })
    );
    await page.route('http://localhost:5000/api/resources/unseen', route =>
        route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
                { id: 101, user: { id: 2, email: 'a@example.com' }, description: 'First resource', status: 'unseen', note: '', date: '2026-08-20T10:00:00.000Z', files: [] },
                { id: 202, user: { id: 3, email: 'b@example.com' }, description: 'Second resource', status: 'unseen', note: '', date: '2026-08-20T10:00:00.000Z', files: [] },
            ]),
        })
    );

    await page.route('http://localhost:5000/api/resources/status', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) })
    );
    await page.route('http://localhost:5000/api/settings', route =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1, hubName: 'The Bridge', contactEmail: 'hub@example.com', defaultCounty: null, acceptingSubmissions: true }) })
    );

    await page.goto('/Dashboard');

    const firstCard = page.locator('.resource-card', { hasText: 'First resource' });
    const secondCard = page.locator('.resource-card', { hasText: 'Second resource' });

    await firstCard.getByPlaceholder('Notes for the submitter (optional)').fill('Note for the first resource');
    await secondCard.getByPlaceholder('Notes for the submitter (optional)').fill('Note for the second resource');

    // Approve the FIRST card, which was rendered before the second. A
    // shared-ref bug would submit the second card's note here instead,
    // since it was the last input rendered. Race the click against
    // waitForRequest (rather than reading a variable set by the route
    // handler afterward) so the assertion can't run before the request
    // has actually been captured.
    const [statusRequest] = await Promise.all([
        page.waitForRequest('**/api/resources/status'),
        firstCard.getByRole('button', { name: 'Approve' }).click(),
    ]);

    expect(statusRequest.postDataJSON()).toEqual({ id: 101, status: 'approved', note: 'Note for the first resource' });
});
