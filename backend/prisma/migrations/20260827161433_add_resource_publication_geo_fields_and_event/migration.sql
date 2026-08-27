/*
  Warnings:

  - Added the required column `updatedAt` to the `Resource` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Resource" ADD COLUMN     "counties" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "districts" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "published" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "link" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);
