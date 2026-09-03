import { prisma } from '../db/connection';
import express, { Request, Response } from 'express';
import { requireRole } from '../routes/roles';
import Role from '../models/role';
const router = express.Router();

const DEFAULT_SETTINGS = {
    id: 1,
    hubName: 'The Bridge',
    contactEmail: '',
    defaultCounty: null,
    acceptingSubmissions: true,
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The settings row is a singleton (always id=1) - lazily created on first
// access rather than seeded via migration, so there's one source of truth
// for its defaults.
export async function getOrCreateSettings() {
    return prisma.settings.upsert({
        where: { id: 1 },
        create: DEFAULT_SETTINGS,
        update: {},
    });
}

// Counselors can read settings too (they need to know whether submissions
// are open), but only admins can change them.
router.get('/', requireRole(Role.Admin, Role.Counselor), async (req: Request, res: Response) => {
    const settings = await getOrCreateSettings();
    res.json(settings);
});

// Public, unauthenticated: only the fields relevant to a public visitor
// (hub identity + a contact channel). defaultCounty/acceptingSubmissions
// aren't public-facing, so they're deliberately left out of this shape.
router.get('/public', async (req: Request, res: Response) => {
    const settings = await getOrCreateSettings();
    res.json({ hubName: settings.hubName, contactEmail: settings.contactEmail });
});

router.patch('/', requireRole(Role.Admin), async (req: Request, res: Response) => {
    await getOrCreateSettings();

    const data: {
        hubName?: string;
        contactEmail?: string;
        defaultCounty?: string | null;
        acceptingSubmissions?: boolean;
    } = {};

    if ('hubName' in req.body) {
        const hubName = req.body.hubName;
        if (typeof hubName !== 'string' || hubName.trim().length === 0) {
            return res.status(400).json({ error: 'Hub name must be a non-empty string.' });
        }
        data.hubName = hubName.trim();
    }

    if ('contactEmail' in req.body) {
        const contactEmail = req.body.contactEmail;
        if (typeof contactEmail !== 'string' || !EMAIL_PATTERN.test(contactEmail.trim())) {
            return res.status(400).json({ error: 'Contact email must be a valid email address.' });
        }
        data.contactEmail = contactEmail.trim();
    }

    if ('defaultCounty' in req.body) {
        const defaultCounty = req.body.defaultCounty;
        if (defaultCounty !== null && typeof defaultCounty !== 'string') {
            return res.status(400).json({ error: 'Default county must be a string.' });
        }
        data.defaultCounty = defaultCounty === '' ? null : defaultCounty;
    }

    if ('acceptingSubmissions' in req.body) {
        if (typeof req.body.acceptingSubmissions !== 'boolean') {
            return res.status(400).json({ error: 'Accept resource submissions must be a boolean.' });
        }
        data.acceptingSubmissions = req.body.acceptingSubmissions;
    }

    const updated = await prisma.settings.update({ where: { id: 1 }, data });
    res.json(updated);
});

export default router;
