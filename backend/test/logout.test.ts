import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../server';

const COUNSELOR = { email: 'counselor@example.com', password: 'counselorpassword123' };

test('POST /logout clears the cookie and revokes access', async () => {
    const agent = request.agent(app);

    const loginRes = await agent.post('/login').send(COUNSELOR);
    assert.equal(loginRes.status, 200);

    const meRes = await agent.get('/api/me');
    assert.equal(meRes.status, 200);
    assert.equal(meRes.body.email, COUNSELOR.email);

    const logoutRes = await agent.post('/logout');
    assert.equal(logoutRes.status, 200);
    const cookie = logoutRes.headers['set-cookie']?.[0];
    assert.ok(cookie, 'expected a Set-Cookie header clearing the token');
    assert.match(cookie, /token=;/);
    assert.match(cookie, /Expires=Thu, 01 Jan 1970/);

    const meAfterLogout = await agent.get('/api/me');
    assert.equal(meAfterLogout.body.error, 'Could not authorize user.');
});
