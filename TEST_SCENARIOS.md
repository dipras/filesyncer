# FileSyncer - Test Scenarios (Level 1)

Tujuan: memastikan flow `init`, `watch`, `deploy`, `rsync`, `scp`, ignore rules, dan edge-case fatal sudah aman.

## 0) Prasyarat Test

- Node.js >= 18
- Build sukses: `npm run build`
- Bisa SSH ke target (server test / VM test)
- Untuk test `rsync`: binary `rsync` tersedia di local + remote
- Untuk test `scp`: binary `scp` tersedia di local
- Disarankan pakai target non-production

## 1) Baseline Setup

1. Buat project sample:
   - folder `sandbox/local-app`
   - isi file:
     - `src/index.js`
     - `.env`
     - `uploads/dummy.txt`
     - `.gitignore` berisi `.env` dan `uploads/`
2. Init config:
   - `node dist/cli.js init --config sandbox/sync-rsync.json`
   - copy jadi `sandbox/sync-scp.json`
3. Isi config dasar:
   - `source`: `sandbox/local-app`
   - `destination`: path kosong di remote (mis. `/tmp/filesyncer-test`)
   - `host`, `username`, `port`, `privateKeyPath`

## 2) Smoke Test (harus hijau)

### T1 - `init` command
- Langkah:
  1. Hapus config target
  2. Jalankan `node dist/cli.js init --config sandbox/tmp-sync.json`
- Expected:
  - file config terbuat
  - field default terisi

### T2 - `deploy` pakai rsync
- Config: `syncMethod = "rsync"`
- Langkah:
  1. Jalankan `node dist/cli.js deploy --config sandbox/sync-rsync.json`
- Expected:
  - exit code 0
  - file source muncul di remote

### T3 - `watch` pakai rsync
- Config: `syncMethod = "rsync"`
- Langkah:
  1. Jalankan `node dist/cli.js watch --config sandbox/sync-rsync.json`
  2. Edit `src/index.js`
- Expected:
  - perubahan terkirim ke remote dalam waktu debounce
  - tidak ada error crash

## 3) Regression Test untuk P0 (fatal)

### P0-A - `deploy` dengan SCP
- Tujuan: validasi bug "SCP deploy gagal tanpa events" sudah hilang.
- Config: `syncMethod = "scp"`
- Langkah:
  1. Jalankan `node dist/cli.js deploy --config sandbox/sync-scp.json`
- Expected:
  - **harus sukses** (exit code 0)
  - seluruh file source tersalin ke remote

### P0-B - Watch race/overlap
- Tujuan: pastikan ada queue/lock, tidak ada sync tumpang tindih berbahaya.
- Config: rsync dulu
- Langkah:
  1. Start `watch`
  2. Dalam < 1 detik, ubah 20-50 file sekaligus
  3. Ulang 3 kali burst
- Expected:
  - proses tetap stabil
  - tidak ada error acak akibat overlap
  - hasil akhir remote sama dengan local

### P0-C - SCP nested directory
- Tujuan: pastikan upload file nested berhasil walau folder remote belum ada.
- Config: `syncMethod = "scp"`
- Langkah:
  1. Pastikan remote destination kosong
  2. Buat file local `src/a/b/c/deep.txt`
  3. Jalankan `watch` lalu edit file itu (atau deploy)
- Expected:
  - file remote terbuat di path nested yang benar
  - tidak gagal karena "No such file or directory"

## 4) Regression Test untuk P1 (high)

### P1-A - `.gitignore` respected di deploy
- Config:
  - `excludeFromGitIgnore = true`
  - `.gitignore` berisi `.env` dan `uploads/`
- Langkah:
  1. Jalankan `deploy`
- Expected:
  - `.env` dan `uploads/*` **tidak** ikut ke remote

### P1-B - Delete propagation (optional by config)
- Tujuan: verifikasi perilaku `unlink` jelas.
- Langkah:
  1. Sync awal file `src/to-delete.js`
  2. Hapus file local
  3. Trigger sync via watch
- Expected (pilih sesuai desain final):
  - Jika `deleteRemoteFiles = true`: file remote ikut terhapus
  - Jika `deleteRemoteFiles = false`: file remote tetap ada
  - Tidak ada perilaku ambigu

### P1-C - Concurrency limit
- Tujuan: mencegah overload saat banyak file berubah.
- Langkah:
  1. Burst update 100 file
  2. Pantau CPU/memory dan kestabilan
- Expected:
  - proses tidak freeze/crash
  - tidak ada lonjakan koneksi ekstrem

## 5) Negative/Safety Test

### N1 - Koneksi SSH salah
- Ubah `host` atau `privateKeyPath` jadi invalid.
- Expected:
  - gagal dengan pesan jelas
  - process exit code non-zero

### N2 - `deleteRemoteFiles` warning
- Set `deleteRemoteFiles = true`
- Jalankan `watch` / `deploy`
- Expected:
  - warning bahaya muncul sebelum sync jalan

## 6) Acceptance Checklist (Release Gate)

Semua harus ✅ sebelum rilis:

- [ ] Build sukses (`npm run build`)
- [ ] T1, T2, T3 lulus
- [ ] P0-A, P0-B, P0-C lulus
- [ ] P1-A, P1-B, P1-C lulus
- [ ] N1, N2 lulus
- [ ] README konsisten dengan behavior aktual
- [ ] Versi CLI sama dengan package version

---

## Catatan Eksekusi Cepat

Urutan paling efisien:
1. Jalankan smoke test
2. Jalankan semua P0 regression
3. Jalankan P1
4. Jalankan negative/safety
5. Final checklist
