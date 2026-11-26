# Meetra

Prototipe lofi hitam-putih untuk early test semifinal STACK 2026 oleh tim Heketon. Peserta membuat akun, menyusun profil, dan mencoba pencocokan partner 1-on-1 atau Pod. Akun peserta, profil, Pod, sesi, dan feedback tersimpan di PostgreSQL. Katalog rekomendasi berisi akun dummy, dan kegiatan belajar berlangsung sebagai simulasi.

## Menjalankan secara lokal

Gunakan Node.js 22, pnpm 10.34.9, dan satu database PostgreSQL khusus Meetra. Salin `apps/web/.env.example` ke `apps/web/.env.local` jika file lokal belum ada, lalu isi konfigurasi berikut.

| Variabel | Nilai |
|---|---|
| `DATABASE_URL` | Wajib. URL PostgreSQL lokal atau URL pooled Neon untuk Vercel. |
| `GEMINI_API_KEY` | Key dari Google AI Studio untuk pencocokan AI. Jika kosong atau Gemini gagal, aplikasi memakai pencocokan demo. |
| `GEMINI_MODEL` | Opsional. Default `gemini-3.5-flash-lite`. Model pengganti perlu mendukung keluaran JSON terstruktur. |
| `DISCORD_SERVER_INVITE_URL` | Opsional. Link undangan HTTPS ke server Discord early test, misalnya `https://discord.gg/KODE`. Meetra menampilkan link setelah semua calon anggota contoh menerima undangan simulasi. |

```sh
pnpm install
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Buka [localhost:3000](http://localhost:3000). Perintah migrasi dan seed bisa dijalankan ulang. Seed mengisi 100 akun dummy dengan 25 skill dan tiga Pod contoh. Setiap skill punya minimal tiga kandidat yang bisa mengajar dan tiga yang ingin belajar. Seed tidak menghapus progres peserta. Jalankan `pnpm typecheck` dan `pnpm build` untuk verifikasi.

## Deploy ke Vercel

Buat database Neon khusus early test. Gunakan URL pooled sebagai `DATABASE_URL`, jalankan `pnpm db:migrate` dan `pnpm db:seed` terhadap database itu sebelum membagikan URL. Skrip database membaca `DATABASE_URL` dari environment proses jika tersedia, lalu dari `apps/web/.env.local`. Pastikan database tujuan benar sebelum menjalankan perintah.

Impor repositori ke Vercel, pilih preset **Next.js**, Root Directory **apps/web**, dan Node.js **22.x**. Tambahkan `DATABASE_URL` dan, jika ingin menguji AI, `GEMINI_API_KEY` pada environment Vercel yang dipakai peserta. Setelah deploy, coba daftar dan masuk kembali. Jalankan satu pencarian dan catat apakah labelnya **Pencocokan AI** atau **Pencocokan demo**. [Vercel Monorepos](https://vercel.com/docs/monorepos) · [Neon Connection Pooling](https://neon.com/docs/connect/connection-pooling) · [Google AI Studio](https://aistudio.google.com/apikey)

## Perilaku prototipe dan privasi

- Peserta memakai username, password khusus uji, dan alias. Saat keluar atau berganti browser, peserta bisa masuk lagi untuk melanjutkan onboarding, sesi, atau feedback. Progres versi lama yang tersimpan di browser tidak diimpor.
- Akun dummy sudah terisi dan tersedia sebagai kandidat. Akun tersebut tidak bisa dipakai login. Peserta lain tidak muncul di rekomendasi atau daftar anggota Pod. Pod hasil pembentukan atau topik manual hanya tersedia untuk pembuatnya melalui sesi dan riwayat akun.
- Setiap pencarian menampilkan hingga lima rekomendasi partner atau Pod yang sudah ada, diurutkan berdasarkan skor. Jika belum ada Pod relevan dan anggota yang cocok cukup, layar **Form a new Pod** menampilkan susunan calon anggota. Untuk rekomendasi yang seluruhnya memakai akun contoh, pilih **Send invite** atau **Send invites** untuk mensimulasikan respons sebelum sesi dimulai. Pilihan yang dilewati disembunyikan sampai peserta memulai pencarian baru dari pilihan format.
- Persentase kecocokan dihitung oleh server dari skill (55%), level pengajar terhadap target belajar (20%), jadwal (15%), dan bahasa (10%). Jika target belajar tidak tersedia, bobot level digabung ke skill. Kecocokan semantik yang dikenali Gemini mendapat sebagian bobot skill. Exchange 1-on-1 memerlukan kecocokan skill di kedua arah. Di Pod, skor memakai topik, jadwal Pod, dan anggota yang paling sesuai dengan peran peserta. Skor mengestimasi kecocokan profil. Feedback awal tetap mengukur relevansi dari sudut pandang peserta.
- Gunakan data contoh. Jika Gemini aktif, server mengirim skill, tujuan, preferensi, dan sinyal relevansi dari sesi sebelumnya. Username, password, alias peserta, dan komentar feedback tetap di server. Key juga tetap di server. Batasi pembagian URL ke peserta yang diundang dan pantau pemakaian di Google AI Studio.
- Target pilot di abstrak, yaitu enam sesi terkonfirmasi dalam tujuh hari, baru bisa dinilai saat mahasiswa sungguhan bisa saling terhubung dan berkoordinasi. Early test ini mencatat penyelesaian simulasi, relevansi, dan niat belajar.

## Panduan early test semifinal

Gunakan [EARLY_TESTING.md](EARLY_TESTING.md) untuk skrip fasilitator, uji prototipe, uji interaksi dengan mahasiswa sungguhan, dan template hasil untuk proposal.

Rekrut lima mahasiswa dan lakukan sesi termoderasi. Minta peserta membuat akun uji dengan username unik seperti `peserta01`, memakai password khusus uji dan alias. Mulai dari halaman awal dalam browser privat, atau pilih **Keluar** sebelum pergantian peserta. Jelaskan bahwa kandidat dummy dan sesi disimulasikan, lalu biarkan peserta menavigasi sendiri. Simpan catatan dengan ID peserta seperti P01. Jika peserta berhenti atau membutuhkan petunjuk, catat langkah dan bantu setelah itu.

### Tugas untuk peserta

| Tugas | Bacakan | Profil contoh untuk fasilitator |
|---|---|---|
| 1-on-1 | “Kamu ingin belajar mengolah hasil survei dengan bantuan seorang mahasiswa. Temukan partner, jalani simulasi, lalu beri feedback.” | Daftar dan isi skill ditawarkan Figma, skill dipelajari Python, level Pemula ke Menengah, dan tujuan mengolah data survei. |
| Pod yang sudah ada | “Kamu ingin berlatih membuat prototipe aplikasi bersama mahasiswa lain. Temukan Pod, jalani simulasi, lalu beri feedback.” | Mulai dari profil tugas pertama dan ubah skill yang dipelajari ke Figma, dengan tujuan membuat prototipe aplikasi. Katalog berisi dua Pod Figma. |
| Pembentukan Pod | “Kamu ingin belajar Python bersama beberapa mahasiswa. Temukan Pod yang sesuai, jalani simulasi, lalu beri feedback.” | Gunakan profil dengan kebutuhan Python. Katalog punya mentor dan mentee Python, tanpa Pod Python. Jalankan sebagai tugas tambahan atau pemeriksaan teknis. |
| Cabang mentor | “Kamu ingin membagikan skill Figma. Pod yang muncul kurang sesuai, jadi mulai topik Podmu sendiri.” | Gunakan skill yang ditawarkan Figma. Skenario tambahan untuk memeriksa cabang Offer setelah melewati Pod yang ada. |

Mulai timer saat peserta menerima tugas dan hentikan ketika feedback terkirim atau peserta berhenti. Untuk rekomendasi yang tampil, mintalah peserta memberi nilai relevansi 1–5, menjelaskan alasannya, dan menjawab “Apakah kamu bersedia belajar dengan partner atau Pod ini?” Catat jawaban dan mode pencocokan. Sisipkan pertanyaan ini setelah peserta meninjau rekomendasi dan jeda timer selama wawancara. Target fungsionalitas awalnya minimal empat dari lima peserta menyelesaikan kedua tugas utama tanpa petunjuk navigasi. Catat kecocokan solusi sebagai penilaian dan niat yang dilaporkan peserta.

### Lembar pencatatan

Salin satu baris untuk setiap tugas dan rekomendasi yang dinilai. Gunakan Y/T untuk jawaban kesediaan, atau tulis alasan jika peserta belum bisa memilih.

| ID | Tugas | AI/Demo | Selesai tanpa bantuan | Durasi aktif | Langkah tersendat dan bantuan | Relevansi 1–5 dan alasan | Bersedia dan alasan |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

Untuk proposal, rangkum siapa yang diuji, tugas, tingkat penyelesaian, masalah yang teramati, dan respons tentang relevansi serta kesediaan belajar. Cantumkan batas data fiktif dan risiko privasi. Jika pengujian belum berjalan, pakai panduan ini sebagai rencana validasi dan biarkan hasilnya kosong. Di video, perlihatkan alur yang sudah berjalan dan sebutkan bahwa kandidat adalah dummy dan sesi belajar disimulasikan. Rujukan: *Handbook STACK 2026*, bagian Semifinal Phase dan Technology and AI Usage.

## Pengungkapan teknologi dan AI

- Next.js, React, TypeScript, PostgreSQL, pg, Zod, dan pnpm dipakai untuk aplikasi dan validasi input.
- Gemini API memilih kandidat dari data fiktif dan memberi alasan rekomendasi. Filter hasil, peran Pod, penyimpanan sesi, dan pencocokan demo berjalan lewat kode aplikasi.
- Codex membantu merencanakan, menulis, dan memverifikasi kode serta menyusun panduan early test. Tim perlu mengungkap penggunaan material ini di proposal dan menyampaikan hasil pengujian aktual berdasarkan observasi peserta.
- Alur produk merujuk pada `User Flow.png` dan `Abstract STACK 2026_Heketon.pdf` dari tim Heketon.
