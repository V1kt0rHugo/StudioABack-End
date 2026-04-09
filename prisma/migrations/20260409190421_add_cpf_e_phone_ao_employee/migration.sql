/*
  Warnings:

  - A unique constraint covering the columns `[CPF]` on the table `Employee` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `CPF` to the `Employee` table without a default value. This is not possible if the table is not empty.
  - Added the required column `phone` to the `Employee` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "CPF" TEXT NOT NULL,
ADD COLUMN     "phone" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_CPF_key" ON "Employee"("CPF");
