-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "forwardedFromChatId" TEXT,
ADD COLUMN     "forwardedFromChatName" TEXT,
ADD COLUMN     "forwardedFromMessageId" TEXT;
