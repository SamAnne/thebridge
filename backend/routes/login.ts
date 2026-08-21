import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
const router = express.Router();
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/connection';

router.post('/', async function(req: Request, res: Response, next: NextFunction) {
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