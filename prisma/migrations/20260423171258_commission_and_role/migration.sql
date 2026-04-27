-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MANAGER', 'PROFESSIONAL');

-- AlterTable
ALTER TABLE "Employee" ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'PROFESSIONAL';

-- AlterTable
ALTER TABLE "PerformedServices" ADD COLUMN     "commissionPaidAt" TIMESTAMP(3),
ADD COLUMN     "isCommissionPaid" BOOLEAN NOT NULL DEFAULT false;
