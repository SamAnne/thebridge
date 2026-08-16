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


router.get('/api/me', requireAuth, (req: Request, res: Response) => {
    console.log('sending credentials');
    res.json({ id: (req as any).user.id, email: (req as any).user.email, role: (req as any).user.role });
});

// router.get('/api/users/:id', requireAuth, requireRole(Role.Admin), async (req: Request, res: Response) => {
//     const user = await prisma.user.findUnique({
//         where: { id: Number(req.params.id) },
//         select: { id: true, email: true, role: { select: { role: true } } }
//     });
//     res.json(user);
// });

// app.get('/', (req: Request, res: Response) => {
//   res.render('home', {title: 'Home'});
// });


// app.get('/dashboard', (req: Request, res: Response, next: NextFunction) => {
//   res.render('dashboard', { title: 'Dashboard' });
// });
app.use(router);
app.use('/login', loginRouter);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));