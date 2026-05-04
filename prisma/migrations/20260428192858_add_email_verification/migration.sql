-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verificationCode" TEXT;
