# Panduan early test Meetra

Panduan ini memisahkan dua pertanyaan. **Tahap A** menguji apakah mahasiswa bisa menemukan partner atau Pod yang mereka anggap relevan melalui prototipe. **Tahap B** mengamati apakah mahasiswa sungguhan mulai berkomunikasi, menyepakati jadwal, dan saling membantu setelah diperkenalkan.

## Tahap A — Uji prototipe

### Persiapan fasilitator

1. Rekrut lima mahasiswa yang sedang ingin mempelajari skill di luar kuliah. Gunakan kode P01–P05 untuk catatan. Minta setiap peserta membuat akun baru dengan username uji yang unik, password khusus uji, dan alias.
2. Sebelum sesi, cek katalog pada lingkungan yang akan dipakai. Python memiliki kandidat partner. Figma memiliki dua Pod, **Dasar Prototipe Figma** dan **Latihan Desain Aplikasi**. SQL memiliki kandidat mentor dan mentee serta belum memiliki Pod di katalog. Pastikan aplikasi bisa dibuka dari perangkat peserta.
3. Mulai dari layar awal dalam browser privat atau setelah keluar dari akun sebelumnya. Siapkan timer dan tabel pencatatan. Gunakan data fiktif untuk isian prototipe karena skill, tujuan, dan preferensi dapat dikirim ke Gemini saat pencocokan AI aktif.

### Skrip pembuka

> Kami ingin melihat bagaimana kamu memakai Meetra untuk mencari orang yang bisa diajak belajar. Kami sedang menguji aplikasinya. Pakai alias dan data contoh yang diberikan. Partner dan anggota Pod di prototipe ini fiktif, dan kegiatan belajarnya berupa simulasi. Coba pakai aplikasi seperti biasa sambil menceritakan apa yang sedang kamu pikirkan. Kami akan mencatat tindakan dan masukan dengan kode peserta. Kamu boleh berhenti kapan saja.

### Tugas yang dibacakan

Kolom **Pengaturan dan titik selesai** dipakai fasilitator untuk menyiapkan skenario dan menilai hasil. Bacakan hanya kolom **Instruksi peserta**. Beri data profil contoh yang dibutuhkan tanpa mengarahkan peserta ke menu atau tombol tertentu.

| Tugas | Instruksi peserta | Pengaturan dan titik selesai |
| --- | --- | --- |
| **A1 · Partner Python** | “Kamu perlu mengolah hasil survei kampus dan ingin belajar Python dengan bantuan satu mahasiswa. Buat akun uji, cari partner yang menurutmu cocok, lalu ajak dia belajar.” | Mulai dari halaman awal. Skill yang ditawarkan **Figma** pada level Menengah, skill yang ingin dipelajari **Python**, level Pemula ke Menengah, dan tujuan mengolah survei kampus. Selesai ketika undangan 1-on-1 terkirim. |
| **A2 · Pod Figma** | “Sekarang kamu ingin berlatih membuat prototipe aplikasi bersama beberapa mahasiswa. Cari Pod Figma, bandingkan pilihan yang muncul, lalu pilih satu. Selesaikan simulasi dan berikan feedback.” | Pakai akun yang sama dari beranda. Peserta perlu mengganti skill belajar ke **Figma** dan menyesuaikan tujuannya di **Personalisasi**. Harapkan layar **Pilih Pod untuk bergabung**. Selesai ketika feedback Pod tersimpan. |
| **A3 · Pod baru SQL** (tambahan) | “Kamu ingin belajar menulis kueri SQL bersama beberapa mahasiswa. Cari pilihan di Meetra. Jelaskan apa yang kamu lihat dan bagaimana kamu akan mengajak mereka belajar bersama.” | Gunakan rekomendasi Pod SQL dengan minimal satu akun peserta nyata. Kirim undangan, lalu cek panel notifikasi di akun penerima. Coba jalur menerima dan menolak pada undangan terpisah. Tugas ini di luar target utama. |

Jika peserta tersendat, tanyakan “Apa yang akan kamu coba sekarang?” tanpa menyebut langkah berikutnya. Beri petunjuk hanya setelah peserta meminta bantuan atau memutuskan berhenti. Catat petunjuk itu. Jika A1 tidak selesai, siapkan akun pada kondisi awal A2 agar tugas kedua tetap bisa diamati. Catat bantuan dan kondisi awalnya.

### Apa yang dicatat

- Mulai timer ketika instruksi dibacakan. Hentikan ketika undangan terkirim untuk A1, feedback tersimpan untuk A2, peserta selesai menjelaskan keputusannya untuk A3, atau peserta berhenti. Jeda timer saat pertanyaan wawancara. Catat gangguan teknis bersama durasi agar waktu tiap tugas dapat dipahami.
- Tandai **selesai tanpa bantuan**, **selesai dengan bantuan**, atau **tidak selesai**. Untuk A3, catat apakah peserta memahami usulan Pod dan tahu di mana penerima merespons undangan. Target awalnya **minimal empat dari lima peserta menyelesaikan A1 dan A2 tanpa bantuan**. Hitung peserta yang memenuhi target pada kedua tugas sekaligus.
- Catat label **Pencocokan AI** atau **Pencocokan demo** pada pilihan yang dinilai. Bila daftar mencampur keduanya, catat mode pada pilihan yang dipilih dan sebutkan bahwa daftar campuran.

### Pertanyaan setelah peserta memilih

1. “Seberapa relevan pilihan ini untuk tujuanmu, dari 1 sampai 5? Apa yang membuatmu memberi nilai itu?” Gunakan 1 untuk tidak relevan dan 5 untuk sangat relevan.
2. “Apa arti persentase kecocokan yang kamu lihat? Apa pengaruhnya, kalau ada, pada pilihanmu?”
3. “Apakah kamu bersedia belajar dengan pilihan ini? Apa yang perlu kamu ketahui atau sepakati dulu?”

Setelah semua tugas, tanyakan “Bagian mana yang paling membingungkan?” dan “Kalau ini partner atau Pod sungguhan, apa yang akan kamu lakukan setelah memilihnya?” Catat kesediaan belajar sebagai jawaban peserta.

### Lembar pencatatan Tahap A

Salin satu baris untuk setiap peserta dan tugas. Jika peserta menilai beberapa pilihan, cantumkan pilihan dan sumber pencocokan pada catatan terpisah di baris yang sama.

| ID peserta | Tugas | Hasil tanpa bantuan, dengan bantuan, atau tidak selesai | Waktu | Langkah membingungkan, petunjuk, atau gangguan | Pilihan dan sumber AI/demo | Relevansi 1–5 dan alasan | Arti/pengaruh skor | Bersedia belajar dan alasannya |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| | | | | | | | | |

## Tahap B — Uji interaksi dengan mahasiswa sungguhan

1. Undang peserta Tahap A yang bersedia untuk mencoba tugas belajar singkat. Bila tersedia peserta dengan kebutuhan, skill, dan jadwal yang cocok, fasilitasi **satu pasangan dan satu Pod kecil**. Jika hanya satu format dapat dijalankan, catat formatnya dan alasannya.
2. Minta peserta mengirim undangan Meetra. Pengirim bisa membuka server Discord uji setelah undangan terkirim. Penerima memilih **Accept & Join Discord** atau **Decline** lewat ikon lonceng di Meetra. Fasilitator memberi akses channel privat kepada peserta yang setuju, membuat perkenalan, dan memberi satu tugas yang bisa dikerjakan bersama. Setelah itu, biarkan peserta membuka percakapan dan menentukan jadwalnya. Catat pengingat atau bantuan tambahan dari fasilitator.
3. Mulai jendela **48 jam** saat perkenalan dilakukan. Pada akhir jendela, catat apakah peserta sudah memulai percakapan dan menyepakati jadwal. Tanyakan setelah waktu yang disepakati apakah sesi benar-benar berlangsung dan bantuan apa yang mereka dapat. Sesi yang dijadwalkan setelah jendela uji tetap berstatus **terkonfirmasi** sampai pelaksanaannya diperiksa.

Gunakan definisi yang sama untuk pasangan dan Pod. Catat setiap kejadian secara terpisah agar sesi yang direncanakan dan sesi yang dijalani bisa dibandingkan.

| Kejadian | Kapan dicatat |
| --- | --- |
| Percakapan dimulai | Ada pesan dari peserta yang membahas tujuan belajar, pertanyaan, atau waktu sesi setelah perkenalan. Pesan perkenalan fasilitator dicatat sebagai bantuan. |
| Jadwal terkonfirmasi | Peserta yang akan hadir menyetujui tanggal dan waktu yang sama. |
| Sesi terlaksana | Peserta mengonfirmasi bahwa mereka benar-benar mengerjakan tugas atau belajar bersama. |
| Bantuan konkret dirasakan | Peserta bisa menyebut bantuan yang didapat, misalnya memahami cara menggabungkan dua tabel atau mendapat masukan tentang navigasi desain. |

### Lembar pencatatan Tahap B

Gunakan satu baris per pasangan atau Pod. Untuk setiap status, catat **ya**, **tidak**, atau **belum diketahui** beserta waktu atau ringkasan bila tersedia. Simpan kejadian dan ringkasan respons dengan kode peserta. Biarkan isi chat dan informasi kontak tetap di kanal yang dipilih peserta.

| ID pasangan/Pod dan anggota | Tugas dan waktu perkenalan | Percakapan dimulai | Jadwal terkonfirmasi | Sesi terlaksana | Bantuan yang dirasakan | Hambatan atau bantuan fasilitator |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |

## Ringkasan untuk proposal semifinal

Handbook menerima **rencana validasi atau hasil early test aktual** pada bagian **Validation and Impact**. Jika uji belum dilakukan, gunakan panduan ini sebagai rencana, biarkan tabel hasil kosong, dan isi template di bawah setelah data tersedia. Cantumkan jumlah peserta dan jumlah pasangan atau Pod yang benar-benar ikut, termasuk ketika hasilnya berada di bawah target.

Gunakan template berbahasa Inggris ini untuk merangkum hasil aktual.

> **Prototype test.** We observed [number] university students attempting a Python partner search and a Figma Pod search using simulated profiles. [A1 count]/[number tested] completed the partner task without help, [A2 count]/[number tested] completed the Pod task without help, and [both count]/[number tested] completed both without help. The main friction was [observation]. Participants described recommendation relevance and interpreted the match score as [summary].
>
> **Facilitated interaction test.** We introduced [number] pairs and [number] Pods based on their skills, goals, and availability. [Number]/[number introduced] initiated a conversation within 48 hours, [number]/[number introduced] confirmed a time, and [number]/[number introduced] held a learning interaction by [observation date]. Participants reported [concrete help or friction]. Facilitator involvement consisted of [support provided].
>
> **Limitations and next step.** The prototype used simulated partners. The interaction test used facilitator-led introductions and a channel agreed on by participants. [Observed bottleneck] informed our decision to [prioritize chat, scheduling, or another change]. Participant notes used coded IDs and excluded raw messages and contact details.

Gunakan hasil Tahap B untuk menentukan prioritas setelah match. Jika peserta kesulitan memulai percakapan, pertimbangkan chat sederhana. Jika percakapan sudah berjalan tetapi jadwal sulit disepakati, prioritaskan konfirmasi jadwal. Catatan dari kelompok kecil yang difasilitasi ini belum mengukur efektivitas Gemini dalam menghasilkan sesi nyata. Pilot di abstrak tetap menargetkan **minimal enam sesi terkonfirmasi dalam tujuh hari**, pada uji dua minggu dengan 20 mahasiswa dan pengukuran melalui log platform.

**Rujukan** · [Handbook STACK 2026](Handbook%20STACK%202026.pdf), bagian *Semifinal Phase*, *Validation and Impact*, dan *Execution and Validation*. · [Abstrak Meetra](Abstract%20STACK%202026_Heketon.pdf), bagian *Expected Benefit and Development Plan*.
