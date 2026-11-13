-- CreateIndex
CREATE INDEX IF NOT EXISTS idx_note_embeddings_hnsw
ON note_embeddings USING hnsw (embedding vector_cosine_ops);
