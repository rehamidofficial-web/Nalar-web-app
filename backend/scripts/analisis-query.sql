-- Analisis query Nalar (Task 5.7). Hanya MEMBACA data, tidak mengubah apa pun.
--
-- Cara memakai (Neon Console > SQL Editor, atau psql):
-- 1. Jalankan query nomor 0 untuk mencari ID pengguna dengan catatan terbanyak (hanya ID, bukan data pribadi).
-- 2. Salin file ini ke VS Code, tekan Ctrl+H, ganti teks  GANTI-ID  dengan ID itu (tanpa tanda kutip tambahan).
-- 3. Jalankan query satu per satu. Lihat baris "Execution Time" di paling bawah hasilnya.
--    Tanda perlu perhatian: "Seq Scan on notes" pada tabel yang besar, atau Execution Time di atas ~100 ms.
-- 4. Catat hasilnya di docs/PERFORMA.md.

-- 0. Cari pengguna dengan catatan terbanyak
SELECT user_id, COUNT(*) AS jumlah_catatan FROM notes GROUP BY user_id ORDER BY jumlah_catatan DESC LIMIT 3;

-- 1. Daftar catatan (halaman 1, terbaru)
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title, left(content, 200) FROM notes WHERE user_id = 'GANTI-ID' ORDER BY updated_at DESC LIMIT 10;

-- 2. Daftar catatan, urut judul A-Z
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, title FROM notes WHERE user_id = 'GANTI-ID' ORDER BY title ASC LIMIT 10;

-- 3. Pencarian kata di daftar catatan (hitung total). Ganti kata_uji dengan kata yang ada di catatanmu.
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) FROM notes
WHERE user_id = 'GANTI-ID' AND (title ILIKE '%kata_uji%' OR content ILIKE '%kata_uji%');

-- 4. Filter tag (hitung total). Ganti tag_uji dengan salah satu tagmu.
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) FROM notes WHERE user_id = 'GANTI-ID' AND tags @> ARRAY['tag_uji']::text[];

-- 5. Daftar semua tag dan jumlahnya
EXPLAIN (ANALYZE, BUFFERS)
SELECT t AS tag, COUNT(*)::int AS count FROM notes, UNNEST(tags) AS t
WHERE user_id = 'GANTI-ID' GROUP BY t ORDER BY count DESC, t ASC;

-- 6. Dashboard: jumlah relasi milik pengguna
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*) FROM note_relationships r
WHERE r.source_note_id IN (SELECT id FROM notes WHERE user_id = 'GANTI-ID');

-- 7. Graph: relasi antar 200 catatan terbaru
EXPLAIN (ANALYZE, BUFFERS)
WITH terbaru AS (SELECT id FROM notes WHERE user_id = 'GANTI-ID' ORDER BY updated_at DESC LIMIT 200)
SELECT r.source_note_id, r.target_note_id, r.relationship_type, r.similarity_score
FROM note_relationships r
WHERE r.source_note_id IN (SELECT id FROM terbaru) AND r.target_note_id IN (SELECT id FROM terbaru);

-- 8. Bahan kamus salah ketik (500 catatan terbaru)
EXPLAIN (ANALYZE, BUFFERS)
SELECT title, tags, content FROM notes WHERE user_id = 'GANTI-ID' ORDER BY updated_at DESC LIMIT 500;

-- 9. Pencarian makna (pgvector): memakai embedding catatan pertama yang punya embedding sebagai contoh.
--    Query ini mirip dengan yang dipakai aplikasi, tetapi BELUM diuji oleh Claude (pgvector tidak ada di tempat uji).
EXPLAIN (ANALYZE, BUFFERS)
SELECT n.id, 1 - (e.embedding <=> src.embedding) AS similarity
FROM note_embeddings e
JOIN notes n ON n.id = e.note_id
CROSS JOIN (
  SELECT e2.embedding FROM note_embeddings e2
  JOIN notes n2 ON n2.id = e2.note_id
  WHERE n2.user_id = 'GANTI-ID' LIMIT 1
) src
WHERE n.user_id = 'GANTI-ID'
ORDER BY e.embedding <=> src.embedding
LIMIT 10;
