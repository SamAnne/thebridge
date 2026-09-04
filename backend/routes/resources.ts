import multer from 'multer';
import { supabase } from '../db/supabaseClient';
import { prisma } from '../db/connection';
import express, { Request, Response, NextFunction } from 'express';
import { requireRole } from '../routes/roles';
import { getOrCreateSettings } from '../routes/settings';
import Role from '../models/role';
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post('/', requireRole(Role.Admin, Role.Counselor), upload.array('files', 10), async (req: Request, res: Response) => {
    try {
        const settings = await getOrCreateSettings();
        if (!settings.acceptingSubmissions) {
            return res.status(403).json({ error: 'Resource submissions are currently closed.' });
        }

        const { description } = req.body;
        const userId = (req as any).user.id;
        const files = req.files as Express.Multer.File[];

        const newResource = await prisma.resource.create({
            data: { user: { connect: { id: Number(userId) }}, status: 'unseen', description: String(description), note: '' }
        });

        if (files && files.length > 0) {
            for (const file of files) {
                const fileName = `${Date.now()}_${file.originalname}`;

                const { error: uploadError } = await supabase.storage
                    .from('resources')
                    .upload(fileName, file.buffer, { contentType: file.mimetype });

                if (uploadError) continue; // or handle more gracefully

                const { data: publicUrlData } = supabase.storage
                    .from('resources')
                    .getPublicUrl(fileName);

                await prisma.file.create({
                    data: {
                        url: publicUrlData.publicUrl,
                        fileName: file.originalname,
                        resource: { connect: { id: newResource.id } }
                    }
                });
            }
        }

        const resourceWithFiles = await prisma.resource.findUnique({
            where: { id: newResource.id },
            include: { files: true }
        });

        res.json(resourceWithFiles);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// get all resources from one user
router.get('/user/:id', requireRole(Role.Admin), async (req: Request, res: Response) => {
    console.log('getting all resource from user');
    const resources = await prisma.resource.findMany({
        where: { userId: Number(req.params.id) },
        select: { description: true, status: true, note: true, date: true, files: true }
    });
    res.json(resources);
});

const ADMIN_RESOURCE_SELECT = {
    id: true,
    description: true,
    status: true,
    published: true,
    counties: true,
    districts: true,
    note: true,
    date: true,
    updatedAt: true,
    files: true,
    user: { select: { id: true, email: true } }
} as const;

// Resource Management: every resource, regardless of review/publication state,
// so admins can manage resources after they leave the unseen queue.
router.get('/', requireRole(Role.Admin), async (req: Request, res: Response) => {
    const resources = await prisma.resource.findMany({
        select: ADMIN_RESOURCE_SELECT,
        orderBy: { date: 'desc' }
    });
    res.json(resources);
});

// Public, unauthenticated: only resources deliberately published AND still
// approved (defense in depth - published alone isn't trusted). Explicit
// public-safe shape, no notes/status/published/submitter info.
//
// Optional ?county= / ?district= filtering: an empty counties/districts
// array means the resource is region-wide, not "untagged and hidden" - so
// it matches every filter value, not just an explicit "all" selection.
router.get('/public', async (req: Request, res: Response) => {
    const { county, district } = req.query;
    const and: object[] = [];

    if (typeof county === 'string' && county.trim().length > 0) {
        and.push({ OR: [{ counties: { has: county.trim() } }, { counties: { isEmpty: true } }] });
    }
    if (typeof district === 'string' && district.trim().length > 0) {
        and.push({ OR: [{ districts: { has: district.trim() } }, { districts: { isEmpty: true } }] });
    }

    const resources = await prisma.resource.findMany({
        where: {
            published: true,
            status: 'approved',
            ...(and.length > 0 ? { AND: and } : {})
        },
        select: {
            id: true,
            description: true,
            counties: true,
            districts: true,
            date: true,
            updatedAt: true,
            files: { select: { id: true, url: true, fileName: true } }
        },
        orderBy: { date: 'desc' }
    });
    res.json(resources);
});

// Admin edit: only description/counties/districts are writable here.
// Publication is handled by the dedicated publish/unpublish routes below;
// status/userId/timestamps/files are never accepted from the client.
router.patch('/:id', requireRole(Role.Admin), async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'Invalid resource id' });
    }

    const data: { description?: string; counties?: string[]; districts?: string[] } = {};

    if ('description' in req.body) {
        const description = req.body.description;
        if (typeof description !== 'string' || description.trim().length === 0) {
            return res.status(400).json({ error: 'Description must be a non-empty string.' });
        }
        data.description = description;
    }

    if ('counties' in req.body) {
        const counties = req.body.counties;
        if (!Array.isArray(counties) || !counties.every((c: unknown) => typeof c === 'string')) {
            return res.status(400).json({ error: 'Counties must be an array of strings.' });
        }
        data.counties = counties;
    }

    if ('districts' in req.body) {
        const districts = req.body.districts;
        if (!Array.isArray(districts) || !districts.every((d: unknown) => typeof d === 'string')) {
            return res.status(400).json({ error: 'Districts must be an array of strings.' });
        }
        data.districts = districts;
    }

    const existing = await prisma.resource.findUnique({ where: { id } });
    if (!existing) {
        return res.status(404).json({ error: 'Resource not found' });
    }

    const updated = await prisma.resource.update({
        where: { id },
        data,
        select: ADMIN_RESOURCE_SELECT
    });
    res.json(updated);
});

// Manual publish: only an approved resource may be made public this way.
// Admin-direct publishing (skipping the review queue entirely) is not
// implemented here - see the Phase 4 report for why.
router.post('/:id/publish', requireRole(Role.Admin), async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'Invalid resource id' });
    }

    const existing = await prisma.resource.findUnique({ where: { id } });
    if (!existing) {
        return res.status(404).json({ error: 'Resource not found' });
    }
    if (existing.status !== 'approved') {
        return res.status(400).json({ error: 'Only approved resources can be published.' });
    }

    const updated = await prisma.resource.update({
        where: { id },
        data: { published: true },
        select: ADMIN_RESOURCE_SELECT
    });
    res.json(updated);
});

// Manual unpublish: retains the resource, its files, its review status and
// history - only the publication flag changes. Idempotent.
router.post('/:id/unpublish', requireRole(Role.Admin), async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'Invalid resource id' });
    }

    const existing = await prisma.resource.findUnique({ where: { id } });
    if (!existing) {
        return res.status(404).json({ error: 'Resource not found' });
    }

    const updated = await prisma.resource.update({
        where: { id },
        data: { published: false },
        select: ADMIN_RESOURCE_SELECT
    });
    res.json(updated);
});

const REVIEW_STATUSES = ['unseen', 'approved', 'rejected', 'revision'] as const;

// set status of resource
router.post('/status', requireRole(Role.Admin), async (req: Request, res: Response) => {
    console.log("updating status of resource");
    const { id, status, note } = req.body;

    const resourceId = Number(id);
    if (!Number.isInteger(resourceId)) {
        return res.status(400).json({ error: 'Invalid resource id' });
    }
    if (!REVIEW_STATUSES.includes(status)) {
        return res.status(400).json({ error: 'Invalid status.' });
    }

    // Review state and publication state are separate concepts, but a
    // status change still drives publication: approving makes a resource
    // public, anything else (reject/revision) takes it back down.
    const published = status === 'approved';

    try {
        const resource = await prisma.resource.update({
            where: { id: resourceId },
            data: { status: String(status), note: String(note), published }
        });
        res.json(resource);
    } catch (err) {
        res.status(404).json({ error: 'Resource not found' });
    }
});

// get all resources with a certain status
// by a certain order? oldest to new
// or handle in frontend
router.get('/:status', requireRole(Role.Admin), async (req: Request, res: Response) => {
    console.log('getting all resources with a certain status');
    const resources = await prisma.resource.findMany({
        where: { status: String(req.params.status) },
        select: { id: true, user: { select: { id: true, email: true } }, description: true, status: true, note: true, date: true, files: true },
        orderBy: { date: 'asc' }
    });
    res.json(resources);
});

export default router;