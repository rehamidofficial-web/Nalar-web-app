# Skenario Demo Aplikasi Nalar (DEMO-SKENARIO)

Dokumen ini memandu presentasi demo aplikasi Nalar berdurasi **3 sampai 5 menit** untuk kebutuhan portofolio, mentor, atau calon pengguna.
Seluruh catatan demo telah menggunakan Bahasa Indonesia dengan topik yang saling bersinggungan (*Web Development*, *Database*, *Artificial Intelligence*, dan *Productivity/PKM*).

---

## 1. Urutan Demo (3–5 Menit)

1. **Dashboard (0:00 - 0:45)**:
   - Tunjukkan tampilan muka setelah masuk: ringkasan statistik (Total Catatan, Konsep, Relasi) dan kartu *Catatan Terbaru*.
   - Tekankan bahwa angka statistik dan relasi terhubung langsung secara interaktif ke halaman terkait.
2. **Catatan & Editor (0:45 - 1:45)**:
   - Buka menu **Catatan**: perlihatkan daftar catatan terstruktur dengan tag warna-warni dan pagination.
   - Buka salah satu catatan (misal *Belajar JavaScript Async* atau *Dasar-dasar Relational Database*).
   - Tunjukkan panel samping: **Ringkasan AI** (membuat abstrak instan) dan **Konsep Kunci AI** (ekstraksi entitas pengetahuan).
   - Tunjukkan tombol jalan pintas **"Lihat di Graph"** yang langsung memfokuskan catatan ke dalam jaringan pengetahuan.
3. **Pencarian Semantik / Makna (1:45 - 2:45)**:
   - Buka menu **Pencarian**. Jelaskan ke audiens bahwa pencarian ini **bukan pencarian kata kunci biasa (Ctrl+F)**, melainkan memahami *makna/maksud* pengguna berbasis pgvector embedding.
   - Coba 2-3 kueri rekomendasi dari daftar di bawah.
4. **Knowledge Graph (2:45 - 3:45)**:
   - Buka menu **Graph**. Tunjukkan klaster-klaster pengetahuan yang terbentuk secara otomatis.
   - Klik salah satu titik untuk membuka panel rincian tetangga terhubung.
   - Tunjukkan fitur **"Fokus ke sini"** dan tab **"Daftar"** untuk pengguna yang menyukai representasi tabular.
5. **Asisten AI Terintegrasi (3:45 - 5:00)**:
   - Buka menu **Asisten AI**.
   - Ajukan pertanyaan pengetahuan yang menguji sintesis catatan pribadi. Tunjukkan bahwa AI menjawab dengan menyertakan kartu sumber rujukan nomor catatan yang dapat diklik.
   - Coba 1 pertanyaan di luar topik catatan untuk memperlihatkan batasan jawaban yang jujur (*grounded QA*).

---

## 2. Kalimat Pencarian Rekomendasi (Pencarian Semantik)

Gunakan 6 kueri berikut saat mendemonstrasikan fitur Pencarian Semantik:

| No | Kalimat Pencarian | Hasil Catatan yang Diharapkan | Nilai Demonstrasi |
|:---:|:---|:---|:---|
| 1 | `arsitektur komponen dan state antarmuka web` | `[Contoh] Komponen dan State dalam React`, `[Contoh] Memahami Next.js App Router` | Menemukan catatan relevan tanpa kata kunci harfiah yang sama persis |
| 2 | `penyimpanan data relasional dan optimasi index` | `[Contoh] Dasar-dasar Relational Database dan SQL`, `[Contoh] Mengoptimalkan Kueri Database dengan Index` | Menghubungkan konsep query dan performa basis data |
| 3 | `pencarian semantik dan embedding vektor` | `[Contoh] Pengenalan Vektor dan Vector Search`, `[Contoh] Peran AI dalam Ekstraksi Pengetahuan` | Menemukan topik AI dan basis data pgvector |
| 4 | `kebiasaan belajar dan manajemen catatan` | `[Contoh] Membangun Kebiasaan Belajar Konsisten`, `[Contoh] Memulai Personal Knowledge Management (PKM)` | Menunjukkan pemahaman konsep produktivitas dan Zettelkasten |
| 5 | `keamanan sistem autentikasi dan enkripsi` | `[Contoh] Autentikasi Menggunakan JWT dan Bcrypt`, `[Contoh] Praktik Keamanan Web Dasar (OWASP)` | Mengaitkan konsep keamanan web dan hashing |
| 6 | `cara merawat kucing persia dan makanan terbaiknya` | *Tidak ada catatan yang cocok* / Skor rendah | Membuktikan bahwa pencarian tidak memaksakan hasil yang tidak relevan |

---

## 3. Pertanyaan untuk Asisten AI (QA Terbimbing)

Ajukan pertanyaan berikut pada sesi demo Asisten AI:

### Pertanyaan 1 (Topik Frontend & Komponen)
> **Tanya**: *"Bagaimana React mengelola antarmuka dan apa keuntungan menggunakan Next.js App Router?"*
- **Sumber yang Diharapkan**: `[Contoh] Komponen dan State dalam React` dan `[Contoh] Memahami Next.js App Router`.
- **Inti Jawaban**: Komponen berbasis state yang reaktif dan rendering optimal React Server Components (RSC) di server.

### Pertanyaan 2 (Topik Basis Data & Indeks)
> **Tanya**: *"Mengapa kita membutuhkan index pada database dan apa dampaknya pada kueri?"*
- **Sumber yang Diharapkan**: `[Contoh] Mengoptimalkan Kueri Database dengan Index` dan `[Contoh] Dasar-dasar Relational Database dan SQL`.
- **Inti Jawaban**: Index mempercepat pencarian WHERE/ORDER BY dengan sedikit trade-off pada penulisan (INSERT/UPDATE).

### Pertanyaan 3 (Topik Ekstraksi Pengetahuan AI)
> **Tanya**: *"Bagaimana cara kerja pencarian vektor di basis data?"*
- **Sumber yang Diharapkan**: `[Contoh] Pengenalan Vektor dan Vector Search` dan `[Contoh] Mengapa Memilih PostgreSQL dan Neon?`.
- **Inti Jawaban**: Membandingkan kedekatan makna (jarak kosinus) representasi embedding, didukung pgvector di PostgreSQL.

### Pertanyaan 4 (Topik Produktivitas & Belajar)
> **Tanya**: *"Apa prinsip utama metode Zettelkasten dalam mencatat?"*
- **Sumber yang Diharapkan**: `[Contoh] Konsep Zettelkasten dalam Menulis Catatan` dan `[Contoh] Memulai Personal Knowledge Management (PKM)`.
- **Inti Jawaban**: Catatan bersifat atomik (satu ide per catatan) dan terhubung satu sama lain seperti jejaring pemikiran.

### Pertanyaan 5 (Pertanyaan Sintesis / Lintas Topik)
> **Tanya**: *"Bagaimana praktik menulis kode yang bersih (clean code) dan aman untuk web?"*
- **Sumber yang Diharapkan**: `[Contoh] Panduan Clean Code untuk Pemula` dan `[Contoh] Praktik Keamanan Web Dasar (OWASP)`.
- **Inti Jawaban**: Fungsi satu tugas spesifik, penamaan yang jelas, sanitasi input untuk cegah SQLi/XSS, dan header keamanan.

### Pertanyaan 6 (Pertanyaan di Luar Catatan)
> **Tanya**: *"Berapa perkiraan jarak tempuh dari Bumi ke planet Mars?"*
- **Jawaban yang Diharapkan**: Asisten dengan sopan menjelaskan bahwa informasi tersebut tidak ditemukan dalam catatan pengetahuan pengguna.
