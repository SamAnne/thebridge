/*
  Warnings:

  - A unique constraint covering the columns `[domain]` on the table `Domains` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Domains_domain_key" ON "Domains"("domain");
