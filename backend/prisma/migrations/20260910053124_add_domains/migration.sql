-- DropForeignKey
ALTER TABLE "File" DROP CONSTRAINT "File_resourceId_fkey";

-- CreateTable
CREATE TABLE "Domains" (
    "id" SERIAL NOT NULL,
    "domain" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "county" TEXT NOT NULL,

    CONSTRAINT "Domains_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "File" ADD CONSTRAINT "File_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
