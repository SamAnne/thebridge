import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../server';

const ADMIN = { email: 'admin@example.com', password: 'adminpassword123' };
const COUNSELOR = { email: 'counselor@example.com', password: 'counselorpassword123' };

test('PATCH /api/users/:id updates name/district/county for admins only, ignores role/password', async () => {
    const adminAgent = request.agent(app);
    await adminAgent.post('/login').send(ADMIN);

    const meRes = await adminAgent.get('/api/me');
    const counselorAgent = request.agent(app);
    await counselorAgent.post('/login').send(COUNSELOR);
    const counselorMe = await counselorAgent.get('/api/me');
    const counselorId = counselorMe.body.id;

    // non-admin is rejected
    const rejected = await counselorAgent.patch(`/api/users/${counselorId}`).send({ name: 'Hacked' });
    assert.equal(rejected.body.error, 'Not allowed with current role.');

    // admin edit succeeds
    const edited = await adminAgent.patch(`/api/users/${counselorId}`).send({
        name: 'Jordan Casey', district: 'North District', county: 'Fairfax',
    });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.name, 'Jordan Casey');
    assert.equal(edited.body.district, 'North District');
    assert.equal(edited.body.county, 'Fairfax');

    // role/password in the body are silently ignored - counselor can still log in with the same password
    await adminAgent.patch(`/api/users/${counselorId}`).send({ role: 'admin', password: 'newpass', name: 'Jordan Casey' });
    const stillCounselorLogin = await request(app).post('/login').send(COUNSELOR);
    assert.equal(stillCounselorLogin.body.success, true);

    // invalid id
    const invalid = await adminAgent.patch('/api/users/abc').send({ name: 'x' });
    assert.equal(invalid.status, 400);

    // nonexistent id
    const missing = await adminAgent.patch('/api/users/999999').send({ name: 'x' });
    assert.equal(missing.status, 404);

    // clearing a field with an empty string sets it to null
    const cleared = await adminAgent.patch(`/api/users/${counselorId}`).send({ county: '' });
    assert.equal(cleared.body.county, null);

    // restore for other tests/manual use
    await adminAgent.patch(`/api/users/${counselorId}`).send({ county: 'Fairfax' });
});
