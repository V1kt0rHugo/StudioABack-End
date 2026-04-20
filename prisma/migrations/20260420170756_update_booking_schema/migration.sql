/*
  Warnings:

  - Added the required column `EndTime` to the `CustomerService` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CustomerService" ADD COLUMN     "EndTime" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Services" ADD COLUMN     "estimatedDuration" INTEGER NOT NULL DEFAULT 30;
