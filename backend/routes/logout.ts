import express, { Request, Response } from 'express';
const router = express.Router();

router.post('/', (req: Request, res: Response) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
    });
    res.json({ success: true });
});

export default router;
