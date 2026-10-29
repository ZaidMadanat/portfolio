-- AlterEnum
ALTER TYPE "EmailSendStatus" ADD VALUE 'SENDING';

-- AlterTable
ALTER TABLE "EmailSend" ADD COLUMN     "claimedAt" TIMESTAMP(3);
