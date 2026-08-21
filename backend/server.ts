import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { requireAuth } from './routes/roles';
import loginRouter from './routes/login';
import resourcesRouter from './routes/resources';
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


app.use(router);
app.use('/login', loginRouter);
app.use('/api/resources', resourcesRouter)

if (require.main === module) {
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;