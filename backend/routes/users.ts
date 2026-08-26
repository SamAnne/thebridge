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
            active: true,
            role: { select: { role: true } }
        }
    });
    res.json(users);
});

// update a user's name/district/county/role/active (not email or password)
router.patch('/:id', requireAuth, requireRole(Role.Admin), async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
        return res.status(400).json({ error: 'Invalid user id' });
    }

    const actingUserId = (req as any).user.id;
    const data: { name?: string | null; district?: string | null; county?: string | null; roleId?: number; active?: boolean } = {};
    if ('name' in req.body) data.name = req.body.name || null;
    if ('district' in req.body) data.district = req.body.district || null;
    if ('county' in req.body) data.county = req.body.county || null;

    if ('role' in req.body) {
        if (actingUserId === id) {
            return res.status(400).json({ error: 'You cannot change your own role.' });
        }

        const newRole = await prisma.role.findUnique({ where: { role: req.body.role } });
        if (!newRole) {
            return res.status(400).json({ error: 'Invalid role.' });
        }

        const target = await prisma.user.findUnique({ where: { id }, include: { role: true } });
        if (!target) {
            return res.status(404).json({ error: 'User not found' });
        }

        if (target.role.role === Role.Admin && newRole.role !== Role.Admin) {
            const otherAdmins = await prisma.user.count({
                where: { role: { role: Role.Admin }, active: true, id: { not: id } }
            });
            if (otherAdmins === 0) {
                return res.status(400).json({ error: 'Cannot remove the last remaining admin.' });
            }
        }

        data.roleId = newRole.id;
    }

    if ('active' in req.body) {
        const active = Boolean(req.body.active);

        if (!active) {
            if (actingUserId === id) {
                return res.status(400).json({ error: 'You cannot disable your own account.' });
            }

            const target = await prisma.user.findUnique({ where: { id }, include: { role: true } });
            if (!target) {
                return res.status(404).json({ error: 'User not found' });
            }

            if (target.role.role === Role.Admin && target.active) {
                const otherActiveAdmins = await prisma.user.count({
                    where: { role: { role: Role.Admin }, active: true, id: { not: id } }
                });
                if (otherActiveAdmins === 0) {
                    return res.status(400).json({ error: 'Cannot disable the last remaining admin.' });
                }
            }
        }

        data.active = active;
    }

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
                active: true,
                role: { select: { role: true } }
            }
        });
        res.json(updated);
    } catch (err) {
        res.status(404).json({ error: 'User not found' });
    }
});

export default router;
