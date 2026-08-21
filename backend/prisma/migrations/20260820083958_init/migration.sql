/*
  Warnings:

  - You are about to drop the column `resource` on the `Resource` table. All the data in the column will be lost.
  - Added the required column `description` to the `Resource` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Resource" DROP COLUMN "resource",
ADD COLUMN     "description" TEXT NOT NULL,
ADD COLUMN     "files" TEXT[];
