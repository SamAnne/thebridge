import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../server';

// Requires a reachable DB with the seeded counselor@example.com account
// (see backend/prisma/seed.ts). Skip if that's not set up locally.
const COUNSELOR = { email: 'counselor@example.com', password: 'counselorpassword123' };

test('POST /login sets an httpOnly, SameSite=Lax cookie (not Secure outside production)', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    const res = await request(app).post('/login').send(COUNSELOR);

    process.env.NODE_ENV = originalEnv;

    assert.equal(res.status, 200);
    const cookie = res.headers['set-cookie']?.[0];
    assert.ok(cookie, 'expected a Set-Cookie header');
    assert.match(cookie, /HttpOnly/i);
    assert.match(cookie, /SameSite=Lax/i);
    assert.doesNotMatch(cookie, /Secure/i);
});

test('POST /login sets a Secure cookie in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const res = await request(app).post('/login').send(COUNSELOR);

    process.env.NODE_ENV = originalEnv;

    assert.equal(res.status, 200);
    const cookie = res.headers['set-cookie']?.[0];
    assert.ok(cookie, 'expected a Set-Cookie header');
    assert.match(cookie, /Secure/i);
});
