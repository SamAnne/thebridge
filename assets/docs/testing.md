# Tests

Run: `cd frontend && npm test`

Playwright E2E tests, backend calls mocked (no live server/DB needed).

- `frontend/e2e/login.spec.ts` — failed login stays on `/Login` with error shown; successful login navigates to `/Dashboard`.
- `frontend/e2e/dashboard-rbac.spec.ts` — `/Dashboard` access control: no session or disallowed role redirects to `/Login`; admin and counselor roles reach the page and see their respective view.
