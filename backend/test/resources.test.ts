import 'dotenv/config';
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../server';
import { prisma } from '../db/connection';
import { supabase } from '../db/supabaseClient';
import jwt from 'jsonwebtoken';

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

// deletes both the DB rows and any objects this test may have pushed to the
// real 'resources' bucket, so repeated runs don't pile up orphaned files
async function cleanupResourceAndFiles(resourceId: number) {
    const files = await prisma.file.findMany({ where: { resourceId } });
    if (files.length > 0) {
        await supabase.storage.from('resources').remove(files.map((f) => f.fileName));
    }
    await prisma.resource.delete({ where: { id: resourceId } }).catch(() => {});
}


test('admin Resource Management endpoints reject unauthenticated and counselor requests, allow admin', async () => {
    const resource = await createTestResource();
    try {
        const noAuthList = await request(app).get('/api/resources');
        assert.equal(noAuthList.body.error, 'Could not authorize role of user.');

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

test('GET /api/resources/public geographic filtering: empty arrays are region-wide, matches respect county+district together', async () => {
    // region-wide: no geographic tags at all
    const regionWide = await createTestResource({ status: 'approved', published: true, counties: [], districts: [] });
    // tagged to a specific county+district
    const utahAlpine = await createTestResource({ status: 'approved', published: true, counties: ['Utah'], districts: ['Alpine School District'] });
    // tagged to a different county, same district
    const wasatchAlpine = await createTestResource({ status: 'approved', published: true, counties: ['Wasatch'], districts: ['Alpine School District'] });
    // tagged to Utah county, but a different district
    const utahOtherDistrict = await createTestResource({ status: 'approved', published: true, counties: ['Utah'], districts: ['Nebo School District'] });
    // county-tagged but district-agnostic (empty districts)
    const utahAnyDistrict = await createTestResource({ status: 'approved', published: true, counties: ['Utah'], districts: [] });

    const allIds = [regionWide.id, utahAlpine.id, wasatchAlpine.id, utahOtherDistrict.id, utahAnyDistrict.id];
    try {
        // no filter: everything approved+published shows up, geography irrelevant
        const noFilter = await request(app).get('/api/resources/public');
        const noFilterIds = noFilter.body.map((r: any) => r.id);
        for (const id of allIds) assert.ok(noFilterIds.includes(id), `expected ${id} with no filter`);

        // county=Utah: matches Utah-tagged resources AND region-wide (empty counties)
        const byCounty = await request(app).get('/api/resources/public').query({ county: 'Utah' });
        const byCountyIds = byCounty.body.map((r: any) => r.id);
        assert.ok(byCountyIds.includes(regionWide.id), 'region-wide (empty counties) should match any county filter');
        assert.ok(byCountyIds.includes(utahAlpine.id));
        assert.ok(byCountyIds.includes(utahOtherDistrict.id));
        assert.ok(byCountyIds.includes(utahAnyDistrict.id));
        assert.ok(!byCountyIds.includes(wasatchAlpine.id), 'Wasatch-only resource should not match county=Utah');

        // district=Alpine School District: matches Alpine-tagged AND region-wide/district-agnostic
        const byDistrict = await request(app).get('/api/resources/public').query({ district: 'Alpine School District' });
        const byDistrictIds = byDistrict.body.map((r: any) => r.id);
        assert.ok(byDistrictIds.includes(regionWide.id));
        assert.ok(byDistrictIds.includes(utahAlpine.id));
        assert.ok(byDistrictIds.includes(wasatchAlpine.id));
        assert.ok(byDistrictIds.includes(utahAnyDistrict.id), 'district-agnostic (empty districts) should match any district filter');
        assert.ok(!byDistrictIds.includes(utahOtherDistrict.id), 'Nebo-tagged resource should not match district=Alpine School District');

        // county=Utah AND district=Alpine School District: both conditions must hold
        const byBoth = await request(app).get('/api/resources/public').query({ county: 'Utah', district: 'Alpine School District' });
        const byBothIds = byBoth.body.map((r: any) => r.id);
        assert.ok(byBothIds.includes(regionWide.id), 'region-wide always matches');
        assert.ok(byBothIds.includes(utahAlpine.id), 'exact county+district match');
        assert.ok(byBothIds.includes(utahAnyDistrict.id), 'Utah county + district-agnostic matches');
        assert.ok(!byBothIds.includes(wasatchAlpine.id), 'Wasatch + Alpine should be excluded (wrong county)');
        assert.ok(!byBothIds.includes(utahOtherDistrict.id), 'Utah + Nebo should be excluded (wrong district)');

        // nonmatching county with no matching resources at all besides region-wide
        const byNonmatchingCounty = await request(app).get('/api/resources/public').query({ county: 'Salt Lake' });
        const byNonmatchingCountyIds = byNonmatchingCounty.body.map((r: any) => r.id);
        assert.ok(byNonmatchingCountyIds.includes(regionWide.id));
        assert.ok(!byNonmatchingCountyIds.includes(utahAlpine.id));
        assert.ok(!byNonmatchingCountyIds.includes(wasatchAlpine.id));
    } finally {
        await prisma.resource.deleteMany({ where: { id: { in: allIds } } });
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

// The submission toggle must be enforced server-side, not just hidden in
// the UI - this exercises the real POST /api/resources route (multipart
// form, like the actual counselor submission form), not the direct-Prisma
// createTestResource helper the rest of this file uses.
test('POST /api/resources is rejected when submissions are closed, allowed when open', async () => {
    let createdId: number | null = null;
    try {
        await adminAgent.patch('/api/settings').send({ acceptingSubmissions: false });

        const rejected = await counselorAgent.post('/api/resources').field('description', 'submitted while closed');
        assert.equal(rejected.status, 403);
        assert.equal(rejected.body.error, 'Resource submissions are currently closed.');

        const stillNone = await prisma.resource.findFirst({ where: { description: 'submitted while closed' } });
        assert.equal(stillNone, null, 'no resource should have been created while closed');

        await adminAgent.patch('/api/settings').send({ acceptingSubmissions: true });

        const allowed = await counselorAgent.post('/api/resources').field('description', 'submitted while open');
        assert.equal(allowed.status, 200);
        assert.equal(allowed.body.description, 'submitted while open');
        createdId = allowed.body.id;
    } finally {
        await adminAgent.patch('/api/settings').send({ acceptingSubmissions: true });
        if (createdId) {
            await prisma.resource.delete({ where: { id: createdId } });
        }
    }
});

async function attachFile(agent: ReturnType<typeof request.agent>, resourceId: number, filename: string, extra?: (req: any) => any) {
    let req = agent
        .patch(`/api/resources/update/${resourceId}`)
        .attach('newFiles', Buffer.from(`%PDF-1.4 ${filename}`), {
            filename,
            contentType: 'application/pdf',
        });
    return extra ? extra(req) : req;
}


// Every successful PATCH resets status to 'unseen', clears note, and bumps
// updatedAt - regardless of whether description/files were touched.
function assertResetToUnseen(reloaded: { status: string | null | undefined; note: string | null | undefined; updatedAt: Date | null | undefined }, beforeRequestTime: Date) {
    assert.equal(reloaded.status, 'unseen');
    assert.equal(reloaded.note, '');
    assert.ok(reloaded.updatedAt, 'updatedAt should be set');
    assert.ok(
        new Date(reloaded.updatedAt!).getTime() >= beforeRequestTime.getTime(),
        `expected updatedAt (${reloaded.updatedAt}) to be at or after the request time (${beforeRequestTime.toISOString()})`
    );
}
 
test('1. no file, description updated -> description updates, no files are created, status/note/updatedAt reset', async () => {
    const resource = await createTestResource({ description: 'original description', status: 'revision', note: 'fix this' });
    const beforeRequestTime = new Date();
    try {
        const res = await counselorAgent
            .patch(`/api/resources/update/${resource.id}`)
            .field('description', 'updated description only');
 
        assert.equal(res.status, 200);
        assert.equal(res.body.description, 'updated description only');
 
        const reloaded = await prisma.resource.findUnique({ where: { id: resource.id }, include: { files: true } });
        assert.equal(reloaded?.description, 'updated description only');
        assert.equal(reloaded?.files.length, 0);
        assert.ok(reloaded);
        assertResetToUnseen(reloaded!, beforeRequestTime);
    } finally {
        await cleanupResourceAndFiles(resource.id);
    }
});
 
test('2a. no file -> a file is added, description untouched when not sent, status/note/updatedAt reset', async () => {
    const resource = await createTestResource({ description: 'keep me', status: 'revision', note: 'fix this' });
    const beforeRequestTime = new Date();
    try {
        const res = await counselorAgent
            .patch(`/api/resources/update/${resource.id}`)
            .attach('newFiles', Buffer.from('%PDF-1.4 first file'), {
                filename: 'first-file.pdf',
                contentType: 'application/pdf',
            });
        assert.equal(res.status, 200);
 
        const reloaded = await prisma.resource.findUnique({ where: { id: resource.id }, include: { files: true } });
        assert.equal(reloaded?.description, 'keep me');
        assert.equal(reloaded?.files.length, 1);
        const [uploadedFile] = reloaded?.files ?? [];
        assert.ok(uploadedFile, 'expected a file at index 0');
        assert.match(uploadedFile!.fileName, /first-file\.pdf$/);
        assertResetToUnseen(reloaded!, beforeRequestTime);
 
        const uploadedFileName = uploadedFile!.fileName;
        const { data: bucketFiles } = await supabase.storage.from('resources').list('', { search: uploadedFileName });
        assert.ok(bucketFiles?.some((f) => f.name === uploadedFileName));
    } finally {
        await cleanupResourceAndFiles(resource.id);
    }
});
 
test('2b. no file -> a file is added AND description is updated in the same request, status/note/updatedAt reset', async () => {
    const resource = await createTestResource({ description: 'old', status: 'revision', note: 'fix this' });
    const beforeRequestTime = new Date();
    try {
        const res = await counselorAgent
            .patch(`/api/resources/update/${resource.id}`)
            .field('description', 'new')
            .attach('newFiles', Buffer.from('%PDF-1.4 file'), {
                filename: 'combo.pdf',
                contentType: 'application/pdf',
            });
        assert.equal(res.status, 200);
 
        const reloaded = await prisma.resource.findUnique({ where: { id: resource.id }, include: { files: true } });
        assert.equal(reloaded?.description, 'new');
        assert.equal(reloaded?.files.length, 1);
        const [uploadedFile] = reloaded?.files ?? [];
        assert.ok(uploadedFile, 'expected a file at index 0');
        assert.match(uploadedFile!.fileName, /combo\.pdf$/);
        assertResetToUnseen(reloaded!, beforeRequestTime);
    } finally {
        await cleanupResourceAndFiles(resource.id);
    }
});
 
test('3a. has a file -> that file is deleted from the Files table and the bucket, description untouched, status/note/updatedAt reset', async () => {
    const resource = await createTestResource({ description: 'keep me' });
    try {
        const setup = await attachFile(counselorAgent, resource.id, 'to-delete.pdf');
        assert.equal(setup.status, 200);
 
        const [file] = await prisma.file.findMany({ where: { resourceId: resource.id } });
        assert.ok(file, 'setup failed: file was not created');
        const fileName = file!.fileName;
 
        // reset status/note back to something non-default so we can prove THIS request resets them
        await prisma.resource.update({ where: { id: resource.id }, data: { status: 'revision', note: 'fix this' } });
        const beforeRequestTime = new Date();
 
        const res = await counselorAgent
            .patch(`/api/resources/update/${resource.id}`)
            .field('removedFileIds', JSON.stringify([file!.id]));
        assert.equal(res.status, 200);
 
        const reloaded = await prisma.resource.findUnique({ where: { id: resource.id }, include: { files: true } });
        assert.equal(reloaded?.description, 'keep me');
        assert.equal(reloaded?.files.length, 0);
        assertResetToUnseen(reloaded!, beforeRequestTime);
 
        const { data: bucketFiles } = await supabase.storage.from('resources').list('', { search: fileName });
        assert.ok(!bucketFiles?.some((f) => f.name === fileName), 'file object should be gone from the bucket');
    } finally {
        await cleanupResourceAndFiles(resource.id);
    }
});
 
test('3b. has a file -> that file is deleted AND description is updated in the same request, status/note/updatedAt reset', async () => {
    const resource = await createTestResource({ description: 'old' });
    try {
        const setup = await attachFile(counselorAgent, resource.id, 'to-delete-2.pdf');
        assert.equal(setup.status, 200);
 
        const [file] = await prisma.file.findMany({ where: { resourceId: resource.id } });
        assert.ok(file, 'setup failed: file was not created');
 
        await prisma.resource.update({ where: { id: resource.id }, data: { status: 'revision', note: 'fix this' } });
        const beforeRequestTime = new Date();
 
        const res = await counselorAgent
            .patch(`/api/resources/update/${resource.id}`)
            .field('description', 'new')
            .field('removedFileIds', JSON.stringify([file!.id]));
        assert.equal(res.status, 200);
 
        const reloaded = await prisma.resource.findUnique({ where: { id: resource.id }, include: { files: true } });
        assert.equal(reloaded?.description, 'new');
        assert.equal(reloaded?.files.length, 0);
        assertResetToUnseen(reloaded!, beforeRequestTime);
    } finally {
        await cleanupResourceAndFiles(resource.id);
    }
});
 
test('4. has a file -> another file is added, both remain and both point to the same resource, status/note/updatedAt reset', async () => {
    const resource = await createTestResource();
    try {
        const setup = await attachFile(counselorAgent, resource.id, 'first.pdf');
        assert.equal(setup.status, 200);
 
        await prisma.resource.update({ where: { id: resource.id }, data: { status: 'revision', note: 'fix this' } });
        const beforeRequestTime = new Date();
 
        const res = await counselorAgent
            .patch(`/api/resources/update/${resource.id}`)
            .attach('newFiles', Buffer.from('%PDF-1.4 second'), {
                filename: 'second.pdf',
                contentType: 'application/pdf',
            });
        assert.equal(res.status, 200);
 
        const files = await prisma.file.findMany({ where: { resourceId: resource.id } });
        assert.equal(files.length, 2);
        assert.ok(files.every((f) => f.resourceId === resource.id));
        assert.ok(files.some((f) => f.fileName.includes('first.pdf')));
        assert.ok(files.some((f) => f.fileName.includes('second.pdf')));
 
        const reloaded = await prisma.resource.findUnique({ where: { id: resource.id } });
        assertResetToUnseen(reloaded!, beforeRequestTime);
    } finally {
        await cleanupResourceAndFiles(resource.id);
    }
});
 
test('5. has two files -> one is deleted, the other remains and still points to the resource, status/note/updatedAt reset', async () => {
    const resource = await createTestResource();
    try {
        const setupA = await attachFile(counselorAgent, resource.id, 'keep-this.pdf');
        assert.equal(setupA.status, 200);
        const setupB = await attachFile(counselorAgent, resource.id, 'delete-this.pdf');
        assert.equal(setupB.status, 200);
 
        const filesBefore = await prisma.file.findMany({ where: { resourceId: resource.id } });
        assert.equal(filesBefore.length, 2);
        const toDelete = filesBefore.find((f) => f.fileName.includes('delete-this.pdf'));
        assert.ok(toDelete, 'setup failed: expected file was not found');
 
        await prisma.resource.update({ where: { id: resource.id }, data: { status: 'revision', note: 'fix this' } });
        const beforeRequestTime = new Date();
 
        const res = await counselorAgent
            .patch(`/api/resources/update/${resource.id}`)
            .field('removedFileIds', JSON.stringify([toDelete!.id]));
        assert.equal(res.status, 200);
 
        const filesAfter = await prisma.file.findMany({ where: { resourceId: resource.id } });
        assert.equal(filesAfter.length, 1);
        const [remainingFile] = filesAfter;
        assert.ok(remainingFile, 'expected a remaining file at index 0');
        assert.match(remainingFile!.fileName, /keep-this\.pdf$/);
        assert.equal(remainingFile!.resourceId, resource.id);
 
        const { data: bucketFiles } = await supabase.storage.from('resources').list('', { search: toDelete!.fileName });
        assert.ok(!bucketFiles?.some((f) => f.name === toDelete!.fileName));
 
        const reloaded = await prisma.resource.findUnique({ where: { id: resource.id } });
        assertResetToUnseen(reloaded!, beforeRequestTime);
    } finally {
        await cleanupResourceAndFiles(resource.id);
    }
});
 
test('6. has two files -> a third is added, all three remain and point to the same resource, status/note/updatedAt reset', async () => {
    const resource = await createTestResource();
    try {
        const setupA = await attachFile(counselorAgent, resource.id, 'one.pdf');
        assert.equal(setupA.status, 200);
        const setupB = await attachFile(counselorAgent, resource.id, 'two.pdf');
        assert.equal(setupB.status, 200);
 
        await prisma.resource.update({ where: { id: resource.id }, data: { status: 'revision', note: 'fix this' } });
        const beforeRequestTime = new Date();
 
        const res = await counselorAgent
            .patch(`/api/resources/update/${resource.id}`)
            .attach('newFiles', Buffer.from('%PDF-1.4 three'), {
                filename: 'three.pdf',
                contentType: 'application/pdf',
            });
        assert.equal(res.status, 200);
 
        const files = await prisma.file.findMany({ where: { resourceId: resource.id } });
        assert.equal(files.length, 3);
        assert.ok(files.every((f) => f.resourceId === resource.id));
        assert.ok(files.some((f) => f.fileName.includes('one.pdf')));
        assert.ok(files.some((f) => f.fileName.includes('two.pdf')));
        assert.ok(files.some((f) => f.fileName.includes('three.pdf')));
 
        const reloaded = await prisma.resource.findUnique({ where: { id: resource.id } });
        assertResetToUnseen(reloaded!, beforeRequestTime);
    } finally {
        await cleanupResourceAndFiles(resource.id);
    }
});
 
test('PATCH /api/resources/:id ignores a removedFileIds entry that does not belong to this resource', async () => {
    const resourceA = await createTestResource();
    const resourceB = await createTestResource();
    try {
        const setupRes = await attachFile(counselorAgent, resourceA.id, 'belongs-to-a.pdf');
        assert.equal(setupRes.status, 200, `setup upload failed: ${JSON.stringify(setupRes.body)}`);
 
        const [fileOnA] = await prisma.file.findMany({ where: { resourceId: resourceA.id } });
        assert.ok(fileOnA, 'setup failed: file was not created on resource A');
        const fileOnAId = fileOnA!.id;
 
        // try to delete resource A's file while patching resource B
        const res = await counselorAgent
            .patch(`/api/resources/update/${resourceB.id}`)
            .field('removedFileIds', JSON.stringify([fileOnAId]));
        assert.equal(res.status, 200);
 
        const stillThere = await prisma.file.findUnique({ where: { id: fileOnAId } });
        assert.ok(stillThere, "another resource's file should not be deletable through this route");
    } finally {
        await cleanupResourceAndFiles(resourceA.id);
        await cleanupResourceAndFiles(resourceB.id);
    }
});

async function createSecondCounselorAgent() {
    const role = await prisma.role.upsert({
        where: { role: 'counselor' },
        update: {},
        create: { role: 'counselor' },
    });
 
    const user = await prisma.user.upsert({
        where: { email: 'second-counselor@example.com' },
        update: {},
        create: {
            email: 'second-counselor@example.com',
            password: 'not-used-jwt-is-signed-directly',
            role: { connect: { id: role.id } },
        },
    });
 
    const token = jwt.sign(
        { id: user.id, email: user.email, role: 'counselor', type: 'auth' },
        process.env.JWT_SECRET as string,
        { expiresIn: '1h' }
    );
 
    const agent = request.agent(app);
    // supertest agents don't persist a cookie unless it comes from a real
    // Set-Cookie response, so requests are made with an explicit header
    // instead of relying on the agent's cookie jar.
    return { userId: user.id, cookie: `token=${token}` };
}
 
test("a counselor cannot update another counselor's resource", async () => {
    const resource = await createTestResource({ description: 'owned by the seeded counselor' });
    const other = await createSecondCounselorAgent();
 
    try {
        const res = await request(app)
            .patch(`/api/resources/update/${resource.id}`)
            .set('Cookie', other.cookie)
            .field('description', 'should not be allowed');
 
        assert.notEqual(res.status, 200, 'a non-owning counselor should not be able to update this resource');
 
        const reloaded = await prisma.resource.findUnique({ where: { id: resource.id } });
        assert.equal(reloaded?.description, 'owned by the seeded counselor', 'description should be unchanged');
    } finally {
        await cleanupResourceAndFiles(resource.id);
        await prisma.user.deleteMany({ where: { id: other.userId } });
    }
});
 
test('a counselor CAN update their own resource', async () => {
    const resource = await createTestResource({ description: 'owned by the seeded counselor' });
    try {
        const res = await counselorAgent
            .patch(`/api/resources/update/${resource.id}`)
            .field('description', 'updated by the owning counselor');
 
        assert.equal(res.status, 200);
 
        const reloaded = await prisma.resource.findUnique({ where: { id: resource.id } });
        assert.equal(reloaded?.description, 'updated by the owning counselor');
    } finally {
        await cleanupResourceAndFiles(resource.id);
    }
});
