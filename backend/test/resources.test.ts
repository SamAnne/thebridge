import 'dotenv/config';
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../server';
import { prisma } from '../db/connection';

const ADMIN = { email: 'admin@example.com', password: 'adminpassword123' };
const COUNSELOR = { email: 'counselor@example.com', password: 'counselorpassword123' };

// The /login route is rate-limited (max 10 attempts / 15 min, see
// routes/login.ts). Logging in fresh per test - the pattern the rest of the
// suite uses - would blow through that limit once a file has more than a
// couple of tests, so this file logs in once per role and reuses the
// authenticated agents everywhere except the one test that specifically
// exercises the unauthenticated/counselor-rejection paths.
let adminAgent: ReturnType<typeof request.agent>;
let counselorAgent: ReturnType<typeof request.agent>;

before(async () => {
    adminAgent = request.agent(app);
    await adminAgent.post('/login').send(ADMIN);

    counselorAgent = request.agent(app);
    await counselorAgent.post('/login').send(COUNSELOR);
});

async function createTestResource(overrides: Partial<{
    status: string;
    published: boolean;
    counties: string[];
    districts: string[];
    description: string;
    note: string;
}> = {}) {
    const counselor = await prisma.user.findUnique({ where: { email: COUNSELOR.email } });
    if (!counselor) throw new Error('Seeded counselor account not found - run prisma db seed first');
    return prisma.resource.create({
        data: {
            user: { connect: { id: counselor.id } },
            status: overrides.status ?? 'unseen',
            published: overrides.published ?? false,
            counties: overrides.counties ?? [],
            districts: overrides.districts ?? [],
            description: overrides.description ?? 'test resource',
            note: overrides.note ?? '',
        }
    });
}

test('admin Resource Management endpoints reject unauthenticated and counselor requests, allow admin', async () => {
    const resource = await createTestResource();
    try {
        const noAuthList = await request(app).get('/api/resources');
        assert.equal(noAuthList.body.error, 'Could not authorize user.');

        const listAsCounselor = await counselorAgent.get('/api/resources');
        assert.equal(listAsCounselor.body.error, 'Not allowed with current role.');

        const patchAsCounselor = await counselorAgent.patch(`/api/resources/${resource.id}`).send({ description: 'nope' });
        assert.equal(patchAsCounselor.body.error, 'Not allowed with current role.');

        const publishAsCounselor = await counselorAgent.post(`/api/resources/${resource.id}/publish`);
        assert.equal(publishAsCounselor.body.error, 'Not allowed with current role.');

        const unpublishAsCounselor = await counselorAgent.post(`/api/resources/${resource.id}/unpublish`);
        assert.equal(unpublishAsCounselor.body.error, 'Not allowed with current role.');

        const listAsAdmin = await adminAgent.get('/api/resources');
        assert.equal(listAsAdmin.status, 200);
        assert.ok(Array.isArray(listAsAdmin.body));
        assert.ok(listAsAdmin.body.some((r: any) => r.id === resource.id));
    } finally {
        await prisma.resource.delete({ where: { id: resource.id } });
    }
});

test('admin can edit description/counties/districts, changes persist, protected fields are ignored', async () => {
    const resource = await createTestResource({ status: 'approved', published: true });
    try {
        const res = await adminAgent.patch(`/api/resources/${resource.id}`).send({
            description: 'updated description',
            counties: ['Utah'],
            districts: ['Alpine School District'],
            userId: 999999,
            status: 'rejected',
            published: false,
        });

        assert.equal(res.status, 200);
        assert.equal(res.body.description, 'updated description');
        assert.deepEqual(res.body.counties, ['Utah']);
        assert.deepEqual(res.body.districts, ['Alpine School District']);
        // protected fields sent in the body are silently ignored
        assert.equal(res.body.status, 'approved');
        assert.equal(res.body.published, true);

        const reloaded = await prisma.resource.findUnique({ where: { id: resource.id } });
        assert.equal(reloaded?.userId, resource.userId);
        assert.equal(reloaded?.description, 'updated description');
    } finally {
        await prisma.resource.delete({ where: { id: resource.id } });
    }
});

test('editing a nonexistent resource is 404, an invalid id is 400', async () => {
    const missing = await adminAgent.patch('/api/resources/999999').send({ description: 'x' });
    assert.equal(missing.status, 404);

    const invalid = await adminAgent.patch('/api/resources/abc').send({ description: 'x' });
    assert.equal(invalid.status, 400);
});

test('PATCH validates description/counties/districts types', async () => {
    const resource = await createTestResource();
    try {
        const emptyDescription = await adminAgent.patch(`/api/resources/${resource.id}`).send({ description: '' });
        assert.equal(emptyDescription.status, 400);

        const notArrayCounties = await adminAgent.patch(`/api/resources/${resource.id}`).send({ counties: 'Utah' });
        assert.equal(notArrayCounties.status, 400);

        const nonStringDistricts = await adminAgent.patch(`/api/resources/${resource.id}`).send({ districts: [1, 2] });
        assert.equal(nonStringDistricts.status, 400);
    } finally {
        await prisma.resource.delete({ where: { id: resource.id } });
    }
});

test('POST /api/resources/status keeps status and published in lockstep, preserves note behavior', async () => {
    const toApprove = await createTestResource({ status: 'unseen' });
    const toReject = await createTestResource({ status: 'unseen' });
    const toRevise = await createTestResource({ status: 'unseen' });
    try {
        const approved = await adminAgent.post('/api/resources/status').send({ id: toApprove.id, status: 'approved', note: 'looks good' });
        assert.equal(approved.status, 200);
        assert.equal(approved.body.status, 'approved');
        assert.equal(approved.body.published, true);
        assert.equal(approved.body.note, 'looks good');

        const rejected = await adminAgent.post('/api/resources/status').send({ id: toReject.id, status: 'rejected', note: 'not relevant' });
        assert.equal(rejected.body.status, 'rejected');
        assert.equal(rejected.body.published, false);

        const revision = await adminAgent.post('/api/resources/status').send({ id: toRevise.id, status: 'revision', note: 'please fix x' });
        assert.equal(revision.body.status, 'revision');
        assert.equal(revision.body.published, false);
        assert.equal(revision.body.note, 'please fix x');
    } finally {
        await prisma.resource.deleteMany({ where: { id: { in: [toApprove.id, toReject.id, toRevise.id] } } });
    }
});

test('POST /api/resources/status rejects an invalid status', async () => {
    const resource = await createTestResource({ status: 'unseen' });
    try {
        const res = await adminAgent.post('/api/resources/status').send({ id: resource.id, status: 'made-up-status', note: '' });
        assert.equal(res.status, 400);

        const reloaded = await prisma.resource.findUnique({ where: { id: resource.id } });
        assert.equal(reloaded?.status, 'unseen');
    } finally {
        await prisma.resource.delete({ where: { id: resource.id } });
    }
});

test('unpublishing an approved resource keeps status=approved, keeps files/history, does not delete it', async () => {
    const resource = await createTestResource({ status: 'approved', published: true, note: 'previously approved' });
    try {
        const unpublished = await adminAgent.post(`/api/resources/${resource.id}/unpublish`);
        assert.equal(unpublished.status, 200);
        assert.equal(unpublished.body.published, false);
        assert.equal(unpublished.body.status, 'approved');
        assert.equal(unpublished.body.note, 'previously approved');

        const stillExists = await prisma.resource.findUnique({ where: { id: resource.id } });
        assert.ok(stillExists);
        assert.equal(stillExists?.status, 'approved');
    } finally {
        await prisma.resource.delete({ where: { id: resource.id } });
    }
});

test('publish is only allowed for approved resources', async () => {
    const unseenResource = await createTestResource({ status: 'unseen' });
    try {
        const attempt = await adminAgent.post(`/api/resources/${unseenResource.id}/publish`);
        assert.equal(attempt.status, 400);

        const reloaded = await prisma.resource.findUnique({ where: { id: unseenResource.id } });
        assert.equal(reloaded?.published, false);
    } finally {
        await prisma.resource.delete({ where: { id: unseenResource.id } });
    }
});

test('publish/unpublish 404 on a nonexistent resource, 400 on an invalid id', async () => {
    const missingPublish = await adminAgent.post('/api/resources/999999/publish');
    assert.equal(missingPublish.status, 404);

    const invalidUnpublish = await adminAgent.post('/api/resources/abc/unpublish');
    assert.equal(invalidUnpublish.status, 400);
});

test('GET /api/resources/public returns only published+approved resources, in a public-safe shape', async () => {
    const publishedApproved = await createTestResource({
        status: 'approved', published: true, description: 'public one', note: 'admin eyes only note',
    });
    const unpublishedApproved = await createTestResource({ status: 'approved', published: false });
    const unseen = await createTestResource({ status: 'unseen', published: false });
    const rejected = await createTestResource({ status: 'rejected', published: false });
    const revision = await createTestResource({ status: 'revision', published: false });
    try {
        const res = await request(app).get('/api/resources/public');
        assert.equal(res.status, 200);

        const ids = res.body.map((r: any) => r.id);
        assert.ok(ids.includes(publishedApproved.id));
        assert.ok(!ids.includes(unpublishedApproved.id));
        assert.ok(!ids.includes(unseen.id));
        assert.ok(!ids.includes(rejected.id));
        assert.ok(!ids.includes(revision.id));

        const found = res.body.find((r: any) => r.id === publishedApproved.id);
        assert.equal(found.description, 'public one');
        assert.equal(found.note, undefined);
        assert.equal(found.status, undefined);
        assert.equal(found.published, undefined);
        assert.equal(found.user, undefined);
        assert.equal(found.userId, undefined);
    } finally {
        await prisma.resource.deleteMany({
            where: { id: { in: [publishedApproved.id, unpublishedApproved.id, unseen.id, rejected.id, revision.id] } }
        });
    }
});

// Exercises the exact same publish/unpublish endpoints the Admin Resource
// Management UI calls, chained end-to-end against the public endpoint - this
// verifies the admin UI's actions actually control public visibility rather
// than just flipping an admin-only badge.
test('publishing/unpublishing through the admin endpoints is reflected live on the public endpoint', async () => {
    const resource = await createTestResource({ status: 'approved', published: false });
    try {
        const beforePublish = await request(app).get('/api/resources/public');
        assert.ok(!beforePublish.body.some((r: any) => r.id === resource.id), 'approved-but-unpublished resource should not be public yet');

        await adminAgent.post(`/api/resources/${resource.id}/publish`);
        const afterPublish = await request(app).get('/api/resources/public');
        assert.ok(afterPublish.body.some((r: any) => r.id === resource.id), 'publishing should make it public immediately');

        await adminAgent.post(`/api/resources/${resource.id}/unpublish`);
        const afterUnpublish = await request(app).get('/api/resources/public');
        assert.ok(!afterUnpublish.body.some((r: any) => r.id === resource.id), 'unpublishing should remove it from the public endpoint immediately');

        await adminAgent.post(`/api/resources/${resource.id}/publish`);
        const afterRepublish = await request(app).get('/api/resources/public');
        assert.ok(afterRepublish.body.some((r: any) => r.id === resource.id), 'publishing again should make it public again');
    } finally {
        await prisma.resource.delete({ where: { id: resource.id } });
    }
});
