import multer from 'multer';
import { supabase } from '../db/supabaseClient';
import { prisma } from '../db/connection';
import express, { Request, Response, NextFunction } from 'express';
import { requireAuth, requireRole } from '../routes/roles';
import Role from '../models/role';
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post('/', requireAuth, requireRole(Role.Admin, Role.Counselor), upload.array('files', 10), async (req: Request, res: Response) => {
    try {
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
router.get('/user/:id', requireAuth, requireRole(Role.Admin), async (req: Request, res: Response) => {
    console.log('getting all resource from user');
    const resources = await prisma.resource.findMany({
        where: { userId: Number(req.params.id) },
        select: { description: true, status: true, note: true, date: true, files: true }
    });
    res.json(resources);
});

// set status of resource
router.post('/status', requireAuth, requireRole(Role.Admin), async (req: Request, res: Response) => {
    console.log("updating status of resource");
    const { id, status, note } = req.body;
    const resource = await prisma.resource.update({
        where: { id: Number(id) },
        data: { status: String(status), note: String(note) }
    });
    res.json(resource);
});

// get all resources with a certain status
// by a certain order? oldest to new
// or handle in frontend
router.get('/:status', requireAuth, requireRole(Role.Admin), async (req: Request, res: Response) => {
    console.log('getting all resources with a certain status');
    const resources = await prisma.resource.findMany({
        where: { status: String(req.params.status) },
        select: { id: true, user: { select: { id: true, email: true } }, description: true, status: true, note: true, date: true, files: true },
        orderBy: { date: 'asc' }
    });
    res.json(resources);
});

export default router;