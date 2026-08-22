import { prisma } from '../db/connection';
import express, { Request, Response } from 'express';
import { requireAuth, requireRole } from '../routes/roles';
import Role from '../models/role';
const router = express.Router();

// get all registered users
router.get('/', requireAuth, requireRole(Role.Admin), async (req: Request, res: Response) => {
    const users = await prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            district: true,
            county: true,
            createdAt: true,
            role: { select: { role: true } }
        }
    });
    res.json(users);
});

// update a user's name/district/county (not email, password, or role)
router.patch('/:id', requireAuth, requireRole(Role.Admin), async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'Invalid user id' });
    }

    const data: { name?: string | null; district?: string | null; county?: string | null } = {};
    if ('name' in req.body) data.name = req.body.name || null;
    if ('district' in req.body) data.district = req.body.district || null;
    if ('county' in req.body) data.county = req.body.county || null;

    try {
        const updated = await prisma.user.update({
            where: { id },
            data,
            select: {
                id: true,
                name: true,
                email: true,
                district: true,
                county: true,
                createdAt: true,
                role: { select: { role: true } }
            }
        });
        res.json(updated);
    } catch (err) {
        res.status(404).json({ error: 'User not found' });
    }
});

export default router;
