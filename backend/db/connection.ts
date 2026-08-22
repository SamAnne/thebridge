import dotenv from 'dotenv';
import path from 'path';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const adapter = new PrismaPg({
  connectionString: process.env.connectionstring as string,
});

export const prisma = new PrismaClient({ adapter });