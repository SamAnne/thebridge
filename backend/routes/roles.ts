import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import Role from '../models/role';
import { prisma } from '../db/connection';

// Verifies the JWT, then re-fetches the user's *current* role from the
// database rather than trusting the role baked into the token - a token
// stays valid for up to a day, so without this a role change or a
// disabled account wouldn't take effect until the old token expired.
async function authenticate(req: Request): Promise<{ id: number; email: string; role: string } | null> {
    const token = req.cookies.token;
    if (!token) return null;

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
    const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        include: { role: true }
    });
    if (!user) return null;

    return { id: user.id, email: user.email, role: user.role.role };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
    authenticate(req)
        .then(user => {
            if (!user) {
                console.log('cant find user');
                return res.json({ error: 'Could not authorize user.' });
            }
            (req as any).user = user;
            next();
        })
        .catch(error => {
            res.clearCookie('token');
            console.log('server error');
            return res.json({ error: 'Server Error.' });
        });
}

export function requireRole(...allowedRoles: Role[]) {
    return function(req: Request, res: Response, next: NextFunction) {
        authenticate(req)
            .then(user => {
                if (!user) {
                    console.log('cant find user role');
                    return res.json({ error: 'Could not authorize role of user.' });
                }
                if (!allowedRoles.includes(user.role as Role)) {
                    console.log('not allowed with current role');
                    return res.json({ error: 'Not allowed with current role.' });
                }
                (req as any).user = user;
                next();
            })
            .catch(error => {
                res.clearCookie('token');
                console.log('server error');
                return res.json({ error: 'Server Error.' });
            });
    }
}
