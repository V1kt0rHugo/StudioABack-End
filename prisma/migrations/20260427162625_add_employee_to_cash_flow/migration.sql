-- AlterTable
ALTER TABLE "CashFlowTransaction" ADD COLUMN     "idEmployee" TEXT;

-- AddForeignKey
ALTER TABLE "CashFlowTransaction" ADD CONSTRAINT "CashFlowTransaction_idEmployee_fkey" FOREIGN KEY ("idEmployee") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
