-- AlterTable
ALTER TABLE "Resource" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "hubName" TEXT NOT NULL DEFAULT 'The Bridge',
    "contactEmail" TEXT NOT NULL DEFAULT '',
    "defaultCounty" TEXT,
    "acceptingSubmissions" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);
