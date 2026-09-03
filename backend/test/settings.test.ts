import 'dotenv/config';
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../server';

const ADMIN = { email: 'admin@example.com', password: 'adminpassword123' };
const COUNSELOR = { email: 'counselor@example.com', password: 'counselorpassword123' };

// See resources.test.ts for why agents are logged in once and reused
// rather than per-test (the /login route is rate-limited).
let adminAgent: ReturnType<typeof request.agent>;
let counselorAgent: ReturnType<typeof request.agent>;

before(async () => {
    adminAgent = request.agent(app);
    await adminAgent.post('/login').send(ADMIN);

    counselorAgent = request.agent(app);
    await counselorAgent.post('/login').send(COUNSELOR);
});

test('GET /api/settings requires authentication, allows admin and counselor', async () => {
    const noAuth = await request(app).get('/api/settings');
    assert.equal(noAuth.body.error, 'Could not authorize role of user.');

    const asAdmin = await adminAgent.get('/api/settings');
    assert.equal(asAdmin.status, 200);
    assert.equal(typeof asAdmin.body.hubName, 'string');
    assert.equal(typeof asAdmin.body.contactEmail, 'string');
    assert.equal(typeof asAdmin.body.acceptingSubmissions, 'boolean');

    const asCounselor = await counselorAgent.get('/api/settings');
    assert.equal(asCounselor.status, 200);
    assert.equal(typeof asCounselor.body.acceptingSubmissions, 'boolean');
});

test('GET /api/settings/public requires no authentication and returns only hubName/contactEmail', async () => {
    const res = await request(app).get('/api/settings/public');
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.hubName, 'string');
    assert.equal(typeof res.body.contactEmail, 'string');
    assert.equal(res.body.defaultCounty, undefined);
    assert.equal(res.body.acceptingSubmissions, undefined);
});

test('PATCH /api/settings is admin-only', async () => {
    const asCounselor = await counselorAgent.patch('/api/settings').send({ hubName: 'Hacked Hub' });
    assert.equal(asCounselor.body.error, 'Not allowed with current role.');

    const noAuth = await request(app).patch('/api/settings').send({ hubName: 'Hacked Hub' });
    assert.equal(noAuth.body.error, 'Could not authorize role of user.');
});

test('admin can update hubName/contactEmail/defaultCounty and changes persist', async () => {
    const original = await adminAgent.get('/api/settings');
    try {
        const updated = await adminAgent.patch('/api/settings').send({
            hubName: 'Mountainland Region Hub',
            contactEmail: 'hub-contact@example.com',
            defaultCounty: 'Utah',
        });
        assert.equal(updated.status, 200);
        assert.equal(updated.body.hubName, 'Mountainland Region Hub');
        assert.equal(updated.body.contactEmail, 'hub-contact@example.com');
        assert.equal(updated.body.defaultCounty, 'Utah');

        const reread = await adminAgent.get('/api/settings');
        assert.equal(reread.body.hubName, 'Mountainland Region Hub');
        assert.equal(reread.body.contactEmail, 'hub-contact@example.com');
        assert.equal(reread.body.defaultCounty, 'Utah');

        // clearing defaultCounty with an empty string sets it to null
        const cleared = await adminAgent.patch('/api/settings').send({ defaultCounty: '' });
        assert.equal(cleared.body.defaultCounty, null);
    } finally {
        await adminAgent.patch('/api/settings').send({
            hubName: original.body.hubName,
            contactEmail: original.body.contactEmail,
            defaultCounty: original.body.defaultCounty ?? '',
        });
    }
});

test('PATCH /api/settings validates hubName, contactEmail, and acceptingSubmissions', async () => {
    const emptyHubName = await adminAgent.patch('/api/settings').send({ hubName: '   ' });
    assert.equal(emptyHubName.status, 400);

    const badEmail = await adminAgent.patch('/api/settings').send({ contactEmail: 'not-an-email' });
    assert.equal(badEmail.status, 400);
    assert.equal(badEmail.body.error, 'Contact email must be a valid email address.');

    const badToggle = await adminAgent.patch('/api/settings').send({ acceptingSubmissions: 'yes' });
    assert.equal(badToggle.status, 400);

    // none of the above should have been persisted
    const current = await adminAgent.get('/api/settings');
    assert.notEqual(current.body.hubName.trim(), '');
    assert.notEqual(current.body.contactEmail, 'not-an-email');
});
