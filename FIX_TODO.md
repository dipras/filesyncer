# FileSyncer - FIX TODO Tracker

Status: open  
Scope: Level 1 stabilization

## P0 - Fatal (must fix first)

- [ ] `deploy` gagal saat `syncMethod: "scp"`
  - Root cause: `deploy` memanggil `sync()` tanpa events, tetapi `syncWithScp()` mewajibkan events.
  - References:
    - src/cli.ts#L164
    - src/core/SyncEngine.ts#L201-L204

- [ ] Race condition di watch mode (sync overlap)
  - Root cause: callback async dipanggil tanpa queue/lock sehingga beberapa sync bisa jalan bersamaan.
  - References:
    - src/core/FileWatcher.ts#L106-L114
    - src/cli.ts#L95-L111

- [ ] SCP gagal untuk nested path jika remote dir belum ada
  - Root cause: tidak ada `mkdir -p` di remote sebelum `scp` file ke subfolder.
  - References:
    - src/core/SyncEngine.ts#L225-L246

## P1 - High

- [ ] `deploy` tidak menghormati `.gitignore` walau ada `excludeFromGitIgnore`
  - Root cause: full rsync hanya pakai `ignorePatterns`, tidak merge rules dari `.gitignore`.
  - References:
    - src/utils/IgnoreFilter.ts#L16-L21
    - src/core/SyncEngine.ts#L179-L187

- [ ] Event delete (`unlink`, `unlinkDir`) tidak pernah tersinkron ke remote
  - Root cause: `syncSpecificFiles()` hanya proses `add/change`.
  - References:
    - src/core/FileWatcher.ts#L52-L56
    - src/core/SyncEngine.ts#L79-L101

- [ ] Upload paralel tanpa limit (`Promise.all`) berisiko overload
  - Root cause: tidak ada concurrency limit/throttling.
  - References:
    - src/core/SyncEngine.ts#L97-L101
    - src/core/SyncEngine.ts#L215-L219

## P2 - Medium

- [ ] Versi CLI hardcoded tidak sinkron dengan package version
  - Root cause: CLI set `1.0.0`, package `1.1.1`.
  - References:
    - src/cli.ts#L17
    - package.json#L3

- [ ] README code fence JSON tidak ditutup
  - Root cause: blok di section recommended approach belum ditutup.
  - References:
    - README.md#L158-L169

- [ ] README lisensi tidak konsisten
  - Root cause: metadata MIT, README tulis ISC.
  - References:
    - package.json
    - README.md#L313

---

## Suggested execution order

1. Fix P0 semua
2. Fix P1 semua
3. Rapikan P2 + dokumentasi
4. Tambah regression tests untuk `deploy` (rsync/scp) dan watch queue

## Test plan

- Lihat skenario lengkap di [TEST_SCENARIOS.md](TEST_SCENARIOS.md)
