/*
  Warnings:

  - You are about to drop the column `idEmployee` on the `CustomerService` table. All the data in the column will be lost.
  - You are about to drop the column `commissionPercentage` on the `Services` table. All the data in the column will be lost.
  - Added the required column `commissionPercentage` to the `Employee` table without a default value. This is not possible if the table is not empty.
  - Added the required column `commissionPercentage` to the `PerformedServices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `commissionValue` to the `PerformedServices` table without a default value. This is not possible if the table is not empty.
  - Added the required column `idEmployee` to the `PerformedServices` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "CustomerService" DROP CONSTRAINT "CustomerService_idEmployee_fkey";

-- AlterTable
ALTER TABLE "CustomerService" DROP COLUMN "idEmployee";

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "commissionPercentage" DOUBLE PRECISION NOT NULL;

-- AlterTable
ALTER TABLE "PerformedServices" ADD COLUMN     "commissionPercentage" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "commissionValue" DOUBLE PRECISION NOT NULL,
ADD COLUMN     "idEmployee" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Services" DROP COLUMN "commissionPercentage";

-- AddForeignKey
ALTER TABLE "PerformedServices" ADD CONSTRAINT "PerformedServices_idEmployee_fkey" FOREIGN KEY ("idEmployee") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
