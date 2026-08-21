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
            email: true,
            district: true,
            county: true,
            createdAt: true,
            role: { select: { role: true } }
        }
    });
    res.json(users);
});

export default router;
