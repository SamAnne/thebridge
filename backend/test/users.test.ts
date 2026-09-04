import 'dotenv/config';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
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

    // password in the body is ignored (not a writable field on this route) -
    // counselor can still log in with the same password. role is NOT included
    // here since it's a real writable field now (see the role-change test below).
    await adminAgent.patch(`/api/users/${counselorId}`).send({ password: 'newpass', name: 'Jordan Casey' });
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

test('PATCH /api/users/:id role changes: admin can change others, cannot change own, invalid role rejected', async () => {
    const adminAgent = request.agent(app);
    await adminAgent.post('/login').send(ADMIN);
    const adminMe = await adminAgent.get('/api/me');
    const adminId = adminMe.body.id;

    const counselorAgent = request.agent(app);
    await counselorAgent.post('/login').send(COUNSELOR);
    const counselorMe = await counselorAgent.get('/api/me');
    const counselorId = counselorMe.body.id;

    // admin cannot change their own role
    const selfChange = await adminAgent.patch(`/api/users/${adminId}`).send({ role: 'counselor' });
    assert.equal(selfChange.status, 400);
    assert.equal(selfChange.body.error, 'You cannot change your own role.');

    // invalid role name is rejected
    const invalidRole = await adminAgent.patch(`/api/users/${counselorId}`).send({ role: 'superadmin' });
    assert.equal(invalidRole.status, 400);
    assert.equal(invalidRole.body.error, 'Invalid role.');

    // admin promotes counselor to admin
    const promoted = await adminAgent.patch(`/api/users/${counselorId}`).send({ role: 'admin' });
    assert.equal(promoted.status, 200);
    assert.equal(promoted.body.role.role, 'admin');

    // restore immediately so other tests/manual use see the expected role
    const demoted = await adminAgent.patch(`/api/users/${counselorId}`).send({ role: 'counselor' });
    assert.equal(demoted.status, 200);
    assert.equal(demoted.body.role.role, 'counselor');
});

test('PATCH /api/users/:id active flag: disabling revokes an existing session immediately, blocks login, and recovers on re-enable', async () => {
    const adminAgent = request.agent(app);
    await adminAgent.post('/login').send(ADMIN);
    const adminMe = await adminAgent.get('/api/me');
    const adminId = adminMe.body.id;

    const counselorAgent = request.agent(app);
    await counselorAgent.post('/login').send(COUNSELOR);
    const counselorMe = await counselorAgent.get('/api/me');
    const counselorId = counselorMe.body.id;
    assert.equal(counselorMe.status, 200); // session works while active

    // admin cannot disable their own account
    const selfDisable = await adminAgent.patch(`/api/users/${adminId}`).send({ active: false });
    assert.equal(selfDisable.status, 400);
    assert.equal(selfDisable.body.error, 'You cannot disable your own account.');

    // admin disables the counselor
    const disabled = await adminAgent.patch(`/api/users/${counselorId}`).send({ active: false });
    assert.equal(disabled.status, 200);
    assert.equal(disabled.body.active, false);

    // the counselor's *existing* session (same agent, no new login) is
    // immediately rejected - this is the whole point of the DB-revalidation
    // fix from earlier, now actually exercised by a real feature
    const revoked = await counselorAgent.get('/api/me');
    assert.equal(revoked.body.error, 'Could not authorize user.');

    // a fresh login attempt is also blocked with a specific message
    const blockedLogin = await request(app).post('/login').send(COUNSELOR);
    assert.equal(blockedLogin.body.error, 'This account has been disabled. Contact an administrator.');

    // re-enable restores login
    const reenabled = await adminAgent.patch(`/api/users/${counselorId}`).send({ active: true });
    assert.equal(reenabled.body.active, true);
    const recoveredLogin = await request(app).post('/login').send(COUNSELOR);
    assert.equal(recoveredLogin.body.success, true);
});

test('a validly-signed token for a user that no longer exists gets its cookie cleared', async () => {
    const ghostToken = jwt.sign(
        { id: 999999, email: 'ghost@example.com', role: 'admin' },
        process.env.JWT_SECRET as string,
        { expiresIn: '1d' }
    );

    const meRes = await request(app).get('/api/me').set('Cookie', `token=${ghostToken}`);
    assert.equal(meRes.body.error, 'Could not authorize user.');
    const meCookie = meRes.headers['set-cookie']?.[0];
    assert.ok(meCookie, 'expected a Set-Cookie header clearing the token');
    assert.match(meCookie, /token=;/);
    assert.match(meCookie, /Expires=Thu, 01 Jan 1970/);

    const usersRes = await request(app).get('/api/users').set('Cookie', `token=${ghostToken}`);
    const usersCookie = usersRes.headers['set-cookie']?.[0];
    assert.ok(usersCookie, 'expected a Set-Cookie header clearing the token on the role-gated route too');
    assert.match(usersCookie, /token=;/);
});
