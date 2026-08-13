import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';

const express = require('express');

const app = express();
app.use(express.json());
app.use(cookieParser());

app.set('view engine', 'ejs');
app.set('views', './views');

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


app.get('/', (req: Request, res: Response) => {
  res.render('home', {title: 'Home'});
});


app.get('/dashboard', (req: Request, res: Response, next: NextFunction) => {
  res.render('dashboard', { title: 'Dashboard' });
});

app.get('/login', (req: Request, res: Response, next: NextFunction) => {
  res.render('login', { title: 'Login' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));