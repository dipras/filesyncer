# FileSyncer - FIX TODO Tracker

Status: closed  
Scope: Level 1 stabilization

## P0 - Fatal (must fix first)

- [x] `deploy` gagal saat `syncMethod: "scp"`
  - Root cause: `deploy` memanggil `sync()` tanpa events, tetapi `syncWithScp()` mewajibkan events.
  - References:
    - src/cli.ts#L164
    - src/core/SyncEngine.ts#L201-L204

- [x] Race condition di watch mode (sync overlap)
  - Root cause: callback async dipanggil tanpa queue/lock sehingga beberapa sync bisa jalan bersamaan.
  - References:
    - src/core/FileWatcher.ts#L106-L114
    - src/cli.ts#L95-L111

- [x] SCP gagal untuk nested path jika remote dir belum ada
  - Root cause: tidak ada `mkdir -p` di remote sebelum `scp` file ke subfolder.
  - References:
    - src/core/SyncEngine.ts#L225-L246

## P1 - High

- [x] `deploy` tidak menghormati `.gitignore` walau ada `excludeFromGitIgnore`
  - Root cause: full rsync hanya pakai `ignorePatterns`, tidak merge rules dari `.gitignore`.
  - References:
    - src/utils/IgnoreFilter.ts#L16-L21
    - src/core/SyncEngine.ts#L179-L187

- [x] Event delete (`unlink`, `unlinkDir`) tidak pernah tersinkron ke remote
  - Root cause: `syncSpecificFiles()` hanya proses `add/change`.
  - References:
    - src/core/FileWatcher.ts#L52-L56
    - src/core/SyncEngine.ts#L79-L101

- [x] Upload paralel tanpa limit (`Promise.all`) berisiko overload
  - Root cause: tidak ada concurrency limit/throttling.
  - References:
    - src/core/SyncEngine.ts#L97-L101
    - src/core/SyncEngine.ts#L215-L219

## P2 - Medium

- [x] Versi CLI hardcoded tidak sinkron dengan package version
  - Root cause: CLI set `1.0.0`, package `1.1.1`.
  - References:
    - src/cli.ts#L17
    - package.json#L3

- [x] README code fence JSON tidak ditutup
  - Root cause: blok di section recommended approach belum ditutup.
  - References:
    - README.md#L158-L169

- [x] README lisensi tidak konsisten
  - Root cause: metadata MIT, README tulis ISC.
  - References:
    - package.json
    - README.md#L313

## Re-audit 2026-03-18 (new findings)

Status: open

### P0 - Fatal

- [x] `privateKeyPath` default `~/.ssh/id_rsa` tidak diexpand pada `ssh/scp` (spawn tanpa shell)
  - Dampak: koneksi bisa gagal walau key valid (karena path literal `~` dianggap nama folder).
  - Root cause: path key dipakai langsung tanpa resolve/expand sebelum dipassing ke argumen `-i`.
  - References:
    - src/core/ConfigManager.ts#L54
    - src/core/SyncEngine.ts#L273-L274
    - src/core/SyncEngine.ts#L322-L328
    - src/core/SyncEngine.ts#L377-L388

### P1 - High

- [x] `useGitTracking` tidak konsisten: berlaku di SCP deploy, tidak berlaku di rsync deploy
  - Dampak: behavior berbeda antar `syncMethod`, bisa bikin file untracked ikut terdeploy saat rsync.
  - Root cause: `syncWithRsync()` deploy mode langsung full rsync dari source; filter Git-tracked hanya ada di jalur `collectFilesForFullDeploy()` (SCP).
  - References:
    - src/core/SyncEngine.ts#L48-L57
    - src/core/SyncEngine.ts#L200-L249
    - README.md#L137

- [ ] Belum ada automated test yang jalan di CI/local
  - Dampak: regresi mudah lolos, terutama flow SSH/rsync/scp dan watcher.
  - Root cause: script `test` masih placeholder yang selalu fail.
  - References:
    - package.json#L22
    - TEST_SCENARIOS.md

### P2 - Medium

- [x] `filesChanged` pada deploy selalu `0` walau full sync sukses
  - Dampak: observability/reporting tidak akurat.
  - Root cause: nilai `filesChanged` diambil dari `events?.length`, sementara deploy memanggil `sync()` tanpa events.
  - References:
    - src/core/SyncEngine.ts#L30
    - src/cli.ts#L170

- [x] `addDir` event terdeteksi watcher, tapi tidak ditangani sync engine dan icon log salah
  - Dampak: log bisa misleading (`addDir` ditampilkan ikon delete), dan empty dir baru tidak dipropagasi eksplisit.
  - Root cause: mapping icon di CLI hanya kenal `add/change/else`, sedangkan sync engine hanya memproses `add/change/unlink/unlinkDir`.
  - References:
    - src/core/FileWatcher.ts#L56
    - src/core/SyncEngine.ts#L61-L76
    - src/cli.ts#L109

### Docs / Release Hygiene

- [x] `CHANGELOG.md` belum mencerminkan versi terbaru package
  - Dampak: release notes membingungkan user/contributor.
  - Root cause: changelog terakhir di `1.0.2`, sedangkan package sudah `1.2.0`.
  - References:
    - CHANGELOG.md#L5
    - package.json#L3

---

## Suggested execution order

1. Fix P0 semua
2. Fix P1 semua
3. Rapikan P2 + dokumentasi
4. Tambah regression tests untuk `deploy` (rsync/scp) dan watch queue

## Test plan

- Lihat skenario lengkap di [TEST_SCENARIOS.md](TEST_SCENARIOS.md)
