import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { requireAuth, requireRole } from './routes/roles';
import Role from './models/role';
import loginRouter from './routes/login';
import { prisma } from './db/connection';
import cors from 'cors';

const express = require('express');

const app = express();
app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// if we wanna use html still
// app.set('view engine', 'ejs');
// app.set('views', './views');

// for static html pages
//app.use(express.static(path.join(__dirname, '../public'))); 



const router = express.Router();

app.use((req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies.token;
    if (token) {
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as any;
            res.locals.user = decoded;
        } catch {
            res.locals.user = null;
        }
    }
    next();
});

// authorize current user
router.get('/api/me', requireAuth, (req: Request, res: Response) => {
    console.log('sending credentials');
    res.json({ id: (req as any).user.id, email: (req as any).user.email, role: (req as any).user.role });
});

// add a resource
router.post('/api/resources', requireAuth, requireRole(Role.Admin, Role.Counselor), async (req: Request, res: Response) => {
    console.log('adding resource');
    const { resource, userId } = req.body;
    await prisma.resource.create({
        data: { user: { connect: { id: Number(userId) }}, status: 'unseen', resource: String(resource), note: '' }
    });
});

// get all resources from one user
router.get('/api/resources/user/:id', requireAuth, requireRole(Role.Admin), async (req: Request, res: Response) => {
    console.log('getting all resource from user');
    const resources = await prisma.resource.findMany({
        where: { userId: Number(req.params.id) },
        select: { resource: true, status: true, note: true, date: true }
    });
    res.json(resources);
});

// set status of resource
router.post('/api/resources/status', requireAuth, requireRole(Role.Admin), async (req: Request, res: Response) => {
    console.log("updating status of resource");
    const { id, status, note } = req.body;
    await prisma.resource.update({
        where: { id: Number(id) },
        data: { status: String(status), note: String(note) }
    });
});

// get all resources with a certain status
// by a certain order? oldest to new
// or handle in frontend
router.get('/api/resources/:status', requireAuth, requireRole(Role.Admin), async (req: Request, res: Response) => {
    console.log('getting all resources with a certain status');
    const resources = await prisma.resource.findMany({
        where: { status: String(req.params.status) },
        select: { id: true, user: { select: { id: true, email: true } }, resource: true, status: true, note: true, date: true }
    });
    res.json(resources);
});



app.use(router);
app.use('/login', loginRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));