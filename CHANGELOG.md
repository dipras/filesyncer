# Changelog

All notable changes to this project will be documented in this file.

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
