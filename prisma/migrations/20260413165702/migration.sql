-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED');

-- AlterTable
ALTER TABLE "CustomerService" ADD COLUMN     "Status" "ServiceStatus" NOT NULL DEFAULT 'SCHEDULED';

-- CreateTable
CREATE TABLE "PerformedServices" (
    "id" TEXT NOT NULL,
    "idCustomerService" TEXT NOT NULL,
    "idService" TEXT NOT NULL,
    "priceCharged" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PerformedServices_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PerformedServices" ADD CONSTRAINT "PerformedServices_idCustomerService_fkey" FOREIGN KEY ("idCustomerService") REFERENCES "CustomerService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerformedServices" ADD CONSTRAINT "PerformedServices_idService_fkey" FOREIGN KEY ("idService") REFERENCES "Services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
