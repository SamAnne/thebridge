import express, { Request, Response, NextFunction } from 'express';
const router = express.Router();
import jwt from 'jsonwebtoken';
import { prisma } from '../db/connection';
import nodemailer from 'nodemailer';

router.get('/', async (req: Request, res: Response) => {
    const token = req.query.token as string;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET  as string) as unknown as { email: string, type: string }
        
        if (decoded.type !== 'verification'){
            return res.json({ error: "Could not verify user's email." });
        }
        await prisma.user.update({
            where: { email: decoded.email },
            data: { verified: true }
        });
        res.json({ success: true })
    } catch (error) {
        res.json({ error: 'Invalid or expired token' })
    }

});

router.get('/resend', async function(req: Request, res: Response, next: NextFunction) {
    const email = req.query.email as string;
    try {

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return res.json({ error: 'User not found' });
        if (user.verified) return res.json({ error: 'Already verified' });

        const token = jwt.sign(
            { email: email, type: 'verification' },
            process.env.JWT_SECRET as string,
            { expiresIn: '1h' } // token expires in 1 hour
        );
        
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Verify your email',
            html: `
            <h2>Verify your email</h2>
            <p>Click the link below to verify your account:</p>
            <a href="${process.env.APP_URL}/verify?token=${token}&email=${email}">Verify Email</a>
            <p>This link expires in 1 hour.</p>
            `
        });

        res.json({ success: true });
    }
    catch (error: any){
        console.log('CODE:', error.code);
        console.log('META:', error.meta);
        console.log('MESSAGE:', error.message);
        res.json({ error: 'Server error'});
    }
        
});

export default router;