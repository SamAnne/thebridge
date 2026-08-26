import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
const router = express.Router();
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { prisma } from '../db/connection';

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    res.status(429).json({ error: 'Too many login attempts. Please try again in a few minutes.' });
  },
});

router.post('/', loginLimiter, async function(req: Request, res: Response, next: NextFunction) {
  const { email, password } = req.body;
  try {
    const user = await prisma.user.findUnique({
        where: { email },
        include: { role: true }
    });
    console.log(user);
    if (!user) {
      return res.json({ error: 'The email does not exist. Sign up to create an account.' });
    }

    const match = await bcrypt.compare(password, user.password);
    console.log(match);
    if (!match){
      return res.json({ error: 'Invalid email or password' });
    }

    if (!user.active) {
      return res.json({ error: 'This account has been disabled. Contact an administrator.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role.role},
      process.env.JWT_SECRET as string,
      { expiresIn: '1d' } // token expires in 1 day
    );

    // store token in a cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    res.json({ success: true });
  }
  catch (error: any) {
    console.log('CODE:', error.code);
    console.log('META:', error.meta);
    console.log('MESSAGE:', error.message);
    res.status(500).json({ error: 'Server error'});
  }
});



export default router;