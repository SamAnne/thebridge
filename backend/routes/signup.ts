import express, { Request, Response, NextFunction } from 'express';
const router = express.Router();
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../db/connection';
import Role from '../models/role';
import nodemailer from 'nodemailer'



router.post('/', async function(req: Request, res: Response, next: NextFunction) {
    const { email, password, name } = req.body;
    try {
        const encryptedPass = await bcrypt.hash(password, 10);
        const domain = email.split('@')[1]
        const domainRes = await prisma.domains.findUnique({
            where: { domain: domain },
            select: { district: true, county: true }
        });

        if (!domainRes){
           // throw error cs domain is not a school one
           return res.json({ error: 'Invalid email.' });
        }
        
        const user = await prisma.user.create({
            data: { email: email, password: encryptedPass, role: { connect: { role: Role.Counselor }}, name: name, district: domainRes.district, county: domainRes.county, active: true }
        });

        const token = jwt.sign(
            { email: user.email, type: 'verification' },
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
    catch (error: any) {
        console.log('CODE:', error.code);
        console.log('META:', error.meta);
        console.log('MESSAGE:', error.message);
        res.json({ error: 'Server error'});
    }
});

export default router;