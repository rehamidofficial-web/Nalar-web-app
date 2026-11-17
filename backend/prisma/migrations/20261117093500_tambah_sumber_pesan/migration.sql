-- AlterTable
ALTER TABLE "ai_messages" ADD COLUMN IF NOT EXISTS "sources" JSONB;
