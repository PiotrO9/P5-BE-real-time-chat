-- CreateIndex
CREATE INDEX "Message_chatId_content_idx" ON "Message"("chatId", "content");
