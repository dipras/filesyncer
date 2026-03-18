# Changelog

All notable changes to this project will be documented in this file.

## [1.2.1] - 2026-03-18

### Fixed
- Expand `privateKeyPath` values that use `~` before passing to `ssh`/`scp`.
- Keep `useGitTracking` behavior consistent for deploy mode on `rsync` and `scp`.
- Handle directory-create events (`addDir`) in watch sync flows.
- Improve deploy reporting so `filesChanged` reflects synced files (instead of always `0`).
- Improve watch output icon mapping for directory events.

### Changed
- Version bump to `1.2.1`.

## [1.0.2] - 2026-02-24

### Added
- ✨ Initial release of FileSyncer
- 🔍 Real-time file watching using chokidar
- 🚫 Smart filtering with .gitignore support
- 🔒 SSH-based sync with rsync and SCP
- ⚙️ Configuration management (sync.json)
- 🎯 Optional Git tracking integration
- 📦 CLI commands: init, watch, deploy
- ⚡ Debounced file change detection
- 🎨 Beautiful CLI output with chalk and ora
- 📖 Comprehensive documentation

### Features
- File watcher with debouncing
- SSH sync (rsync/SCP)
- Ignore pattern support (.gitignore + custom)
- Git tracking mode
- Connection testing
- Delta transfer with compression
- Graceful shutdown handling
- Progress indicators
- Error handling and reporting

### Tech Stack
- Node.js with TypeScript
- chokidar for file watching
- simple-git for Git integration
- commander.js for CLI
- chalk for colored output
- ora for spinners
- ignore for .gitignore parsing
