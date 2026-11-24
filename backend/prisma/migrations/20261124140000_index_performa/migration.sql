-- Task 5.7: index untuk mempercepat pencarian kata, filter tag, dan urutan judul pada tabel notes.
-- Aman dijalankan ulang (IF NOT EXISTS). Cara membatalkan: lihat docs/PERFORMA.md bagian "Cara membatalkan".

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notes_user_id_title_idx" ON "notes"("user_id", "title");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_notes_judul_trgm" ON "notes" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_notes_isi_trgm" ON "notes" USING GIN ("content" gin_trgm_ops);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "idx_notes_tags_gin" ON "notes" USING GIN ("tags");
