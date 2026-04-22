-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "ConsumedItems" ALTER COLUMN "usedQuantity" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Products" ALTER COLUMN "stock" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Services" ADD COLUMN     "returnDaysReminder" INTEGER DEFAULT 0;

-- CreateTable
CREATE TABLE "CashFlowTransaction" (
    "id" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idCustomerService" TEXT,

    CONSTRAINT "CashFlowTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashFlowTransaction_idCustomerService_key" ON "CashFlowTransaction"("idCustomerService");

-- AddForeignKey
ALTER TABLE "CashFlowTransaction" ADD CONSTRAINT "CashFlowTransaction_idCustomerService_fkey" FOREIGN KEY ("idCustomerService") REFERENCES "CustomerService"("id") ON DELETE SET NULL ON UPDATE CASCADE;
