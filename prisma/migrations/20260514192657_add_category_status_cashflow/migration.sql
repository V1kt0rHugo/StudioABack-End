-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('SERVICO_PRESTADO', 'VENDA_PRODUTO', 'PAGAMENTO_COMISSAO', 'COMPRA_INSUMOS', 'ALUGUEL', 'AGUA_LUZ', 'MARKETING', 'SALARIO', 'OUTROS');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PAID', 'PENDING', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'PIX', 'TRANSFER');

-- AlterTable
ALTER TABLE "CashFlowTransaction" ADD COLUMN     "category" "TransactionCategory",
ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "paymentDate" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "status" "TransactionStatus" NOT NULL DEFAULT 'PAID';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
