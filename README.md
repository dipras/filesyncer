# FileSyncer 🚀

**Real-time file synchronization tool for remote development workflows**

FileSyncer is a CLI tool that enables developers to automatically sync files from their local environment to remote servers via SSH. Perfect for development workflows with VPS or remote servers.

## ✨ Features

- 🔍 **Smart File Watching** - Real-time file change detection with debouncing
- 🚫 **Intelligent Filtering** - Support for `.gitignore` patterns and custom ignore rules
- 🔒 **Secure Transfer** - SSH-based transfer using rsync or SCP
- ⚡ **Efficient Sync** - Delta transfer and compression for optimal performance
- 🎯 **Git Integration** - Optional: sync only Git-tracked files
- 📦 **Zero Config Start** - Quick setup with default configuration

## 🔧 Installation

### Global Installation

```bash
npm install -g filesyncer
```

### Local Project

```bash
npm install --save-dev filesyncer
```

### NPX (No Installation Required)

```bash
npx filesyncer init
```

## 🚀 Quick Start

### 1. Initialize Configuration

```bash
npx filesyncer init
```

This creates a `sync.json` file:

```json
{
  "source": ".",
  "destination": "/var/www/app",
  "host": "example.com",
  "username": "user",
  "port": 22,
  "privateKeyPath": "~/.ssh/id_rsa",
  "ignorePatterns": ["node_modules/**", "dist/**", ".git/**"],
  "useGitTracking": false,
  "debounceMs": 1000,
  "syncMethod": "rsync",
  "excludeFromGitIgnore": true
}
```

### 2. Edit Configuration

Update `sync.json` with your server details:

```json
{
  "source": ".",
  "destination": "/home/youruser/myapp",
  "host": "your-server.com",
  "username": "youruser",
  "port": 22,
  "privateKeyPath": "~/.ssh/id_rsa"
}
```

### 3. Start Watching

```bash
npx filesyncer watch
```

Now every time you save a file, it will automatically sync to the server! 🎉

## 📖 Usage

### Commands

#### `init` - Initialize Configuration

```bash
filesyncer init
filesyncer init --config custom-sync.json
```

#### `watch` - Start File Watcher

```bash
filesyncer watch
filesyncer watch --config custom-sync.json
```

Auto-sync whenever files change.

#### `deploy` - One-Time Full Sync

```bash
filesyncer deploy
filesyncer deploy --config custom-sync.json
```

Sync all files once without watching.

## ⚙️ Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `source` | string | `"."` | Source directory (local) |
| `destination` | string | - | Destination path on remote server |
| `host` | string | - | Remote server hostname/IP |
| `username` | string | - | SSH username |
| `port` | number | `22` | SSH port |
| `privateKeyPath` | string | `~/.ssh/id_rsa` | Path to SSH private key |
| `ignorePatterns` | string[] | `[]` | Array of glob patterns to ignore |
| `useGitTracking` | boolean | `false` | Only sync Git-tracked files |
| `debounceMs` | number | `1000` | Debounce delay (ms) |
| `syncMethod` | string | `"rsync"` | Transfer method: `"rsync"` or `"scp"` |
| `excludeFromGitIgnore` | boolean | `true` | Automatically exclude files from `.gitignore` |

## 🎯 Use Cases

### Backend Development on VPS

```bash
# Local development
npm run dev

# In another terminal
filesyncer watch

# Edit code → Auto sync → Test on server
```

### Remote Docker Development

```json
{
  "source": "./src",
  "destination": "/app/src",
  "host": "docker-host.local",
  "syncMethod": "rsync"
}
```

### Multiple Server Sync

Create multiple config files:

```bash
filesyncer watch --config sync-staging.json
filesyncer watch --config sync-production.json
```

## 🔒 Security Best Practices

1. **Use SSH Keys** - Never hardcode passwords
2. **Restrict Key Permissions** - `chmod 600 ~/.ssh/id_rsa`
3. **Use Non-Root User** - Don't sync as root user
4. **Firewall Rules** - Restrict SSH access by IP

## 🐛 Troubleshooting

### Connection Failed

```bash
# Test SSH connection manually
ssh -p 22 user@host

# Verify key permissions
chmod 600 ~/.ssh/id_rsa
```

### rsync Not Found

Install rsync:

```bash
# Ubuntu/Debian
sudo apt install rsync

# macOS
brew install rsync

# Or use SCP fallback
"syncMethod": "scp"
```

### Files Not Syncing

1. Check `.gitignore` patterns
2. Verify `ignorePatterns` in config
3. Check file permissions
4. Enable verbose logging

## 🗺️ Roadmap

### Level 1 ✅ (Current)
- [x] File watcher with chokidar
- [x] SSH sync (rsync/SCP)
- [x] Ignore pattern support
- [x] Basic CLI commands

### Level 2 🚧 (Planned)
- [ ] Queue transfer system
- [ ] Parallel upload
- [ ] Bandwidth throttle
- [ ] Progress reporting
- [ ] Conflict resolution

### Level 3 🔮 (Future)
- [ ] Binary diff transfer
- [ ] Multi-server sync
- [ ] Web dashboard
- [ ] VS Code extension

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

ISC © Dipras

## 💡 Inspiration

FileSyncer was created to solve development workflow challenges:
- ✅ Real-time sync without manual upload
- ✅ Lightweight alternative to Git CI/CD
- ✅ Near real-time development feedback
- ✅ Developer productivity boost

## 🌟 Star This Project

If you find this useful, please consider giving it a star ⭐

---

**Made with ❤️ for developers who love productivity**
