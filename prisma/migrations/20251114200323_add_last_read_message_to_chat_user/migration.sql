-- AlterTable
ALTER TABLE "ChatUser" ADD COLUMN     "lastReadAt" TIMESTAMP(3),
ADD COLUMN     "lastReadMessageId" TEXT;

-- CreateIndex
CREATE INDEX "ChatUser_lastReadMessageId_idx" ON "ChatUser"("lastReadMessageId");

-- AddForeignKey
ALTER TABLE "ChatUser" ADD CONSTRAINT "ChatUser_lastReadMessageId_fkey" FOREIGN KEY ("lastReadMessageId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
