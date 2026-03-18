import { spawn } from 'child_process';
import { resolve, join, posix, relative } from 'path';
import { existsSync, readdirSync } from 'fs';
import { homedir } from 'os';
import type { SyncConfig, FileChangeEvent, SyncResult } from '../types.js';
import { IgnoreFilter } from '../utils/IgnoreFilter.js';
import { GitTracker } from '../utils/GitTracker.js';

export class SyncEngine {
  private readonly maxConcurrentTransfers = 5;

  constructor(private config: SyncConfig) {}

  /**
   * Sync files to remote server
   */
  async sync(events?: FileChangeEvent[]): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      const filesChanged = this.config.syncMethod === 'scp'
        ? await this.syncWithScp(events)
        : await this.syncWithRsync(events);

      const duration = Date.now() - startTime;
      return {
        success: true,
        filesChanged,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      errors.push(error instanceof Error ? error.message : String(error));
      return {
        success: false,
        filesChanged: 0,
        errors,
        duration
      };
    }
  }

  /**
   * Sync using rsync (recommended)
   */
  private async syncWithRsync(events?: FileChangeEvent[]): Promise<number> {
    // If events provided (watch mode), sync only changed files
    if (events && events.length > 0) {
      return this.syncSpecificFilesWithRsync(events);
    }

    // If Git tracking is enabled, keep behavior consistent with SCP deploy
    if (this.config.useGitTracking) {
      const trackedFiles = await this.collectFilesForFullDeploy();
      await this.runWithConcurrency(trackedFiles, this.maxConcurrentTransfers, async (filePath) => {
        await this.rsyncSingleFile(filePath);
      });
      return trackedFiles.length;
    }

    const files = await this.collectFilesForFullDeploy();
    
    // Otherwise, do full sync (deploy mode)
    const args = this.buildRsyncArgs();

    await this.execCommand('rsync', args, 'rsync failed');
    return files.length;
  }

  /**
   * Sync specific files only (watch mode)
   */
  private async syncSpecificFilesWithRsync(events: FileChangeEvent[]): Promise<number> {
    const directoriesToCreate = events.filter(e => e.type === 'addDir');
    const filesToSync = events.filter(e =>
      e.type === 'add' || e.type === 'change'
    );
    const filesToDelete = events.filter(e =>
      e.type === 'unlink' || e.type === 'unlinkDir'
    );

    if (directoriesToCreate.length > 0) {
      await this.runWithConcurrency(directoriesToCreate, this.maxConcurrentTransfers, async (event) => {
        const normalizedPath = this.normalizeRemotePath(event.path);
        const remoteDir = posix.join(this.config.destination, normalizedPath);
        await this.ensureRemoteDirectory(remoteDir);
      });
    }

    if (filesToSync.length > 0) {
      await this.runWithConcurrency(filesToSync, this.maxConcurrentTransfers, async (event) => {
        await this.rsyncSingleFile(event.path);
      });
    }

    if (this.config.deleteRemoteFiles && filesToDelete.length > 0) {
      await this.runWithConcurrency(filesToDelete, this.maxConcurrentTransfers, async (event) => {
        await this.deleteRemotePath(event.path, event.type === 'unlinkDir');
      });
    }

    const deletedCount = this.config.deleteRemoteFiles ? filesToDelete.length : 0;
    return directoriesToCreate.length + filesToSync.length + deletedCount;
  }

  /**
   * Sync single file with rsync
   */
  private async rsyncSingleFile(relativePath: string): Promise<void> {
    const sourcePath = join(this.config.source, relativePath);
    
    if (!existsSync(sourcePath)) {
      // File might have been deleted, skip
      return;
    }

    const args = [
      '-avz', // archive, verbose, compress
      '--relative' // Preserve directory structure
    ];

    // Add SSH configuration
    const sshArgs = [`ssh -p ${this.config.port || 22}`];
    const privateKeyPath = this.resolvePrivateKeyPath();
    if (privateKeyPath) {
      sshArgs.push(`-i ${this.shellQuote(privateKeyPath)}`);
    }
    args.push('-e', sshArgs.join(' '));

    // Source (with ./ prefix for --relative)
    const sourceBase = resolve(this.config.source);
    const normalizedPath = this.normalizeRemotePath(relativePath);
    args.push(`${sourceBase}/./${normalizedPath}`);

    // Destination
    const destination = `${this.config.username}@${this.config.host}:${this.config.destination}`;
    args.push(destination);

    await this.execCommand('rsync', args, `rsync failed for ${relativePath}`);
  }

  /**
   * Build rsync arguments
   */
  private buildRsyncArgs(): string[] {
    const args = [
      '-avz', // archive, verbose, compress
      '--progress'
    ];

    // Only delete remote files if explicitly enabled (DANGEROUS!)
    if (this.config.deleteRemoteFiles) {
      args.push('--delete');
    }

    // Add SSH configuration
    const sshArgs = [`ssh -p ${this.config.port || 22}`];
    const privateKeyPath = this.resolvePrivateKeyPath();
    if (privateKeyPath) {
      sshArgs.push(`-i ${this.shellQuote(privateKeyPath)}`);
    }
    args.push('-e', sshArgs.join(' '));

    // Add exclude patterns
    const excludePatterns = this.config.ignorePatterns || [];
    for (const pattern of excludePatterns) {
      args.push('--exclude', pattern);
    }

    // Optionally include .gitignore patterns for deploy
    if (this.config.excludeFromGitIgnore !== false) {
      const gitignorePath = resolve(this.config.source, '.gitignore');
      if (existsSync(gitignorePath)) {
        args.push('--exclude-from', gitignorePath);
      }
    }

    // Always exclude .git
    args.push('--exclude', '.git');

    // Source and destination
    const source = resolve(this.config.source);
    const destination = `${this.config.username}@${this.config.host}:${this.config.destination}`;

    // Ensure source ends with / for proper rsync behavior
    args.push(source.endsWith('/') ? source : `${source}/`);
    args.push(destination);

    return args;
  }

  /**
   * Sync using SCP (fallback)
   */
  private async syncWithScp(events?: FileChangeEvent[]): Promise<number> {
    if (!events || events.length === 0) {
      return this.fullScpDeploy();
    }

    const directoriesToCreate = events.filter(e => e.type === 'addDir');

    const filesToSync = events.filter(e =>
      e.type === 'add' || e.type === 'change'
    );
    const filesToDelete = events.filter(e =>
      e.type === 'unlink' || e.type === 'unlinkDir'
    );

    if (directoriesToCreate.length > 0) {
      await this.runWithConcurrency(directoriesToCreate, this.maxConcurrentTransfers, async (event) => {
        const normalizedPath = this.normalizeRemotePath(event.path);
        const remoteDir = posix.join(this.config.destination, normalizedPath);
        await this.ensureRemoteDirectory(remoteDir);
      });
    }

    if (filesToSync.length > 0) {
      await this.runWithConcurrency(filesToSync, this.maxConcurrentTransfers, async (event) => {
        await this.scpFile(event.path);
      });
    }

    if (this.config.deleteRemoteFiles && filesToDelete.length > 0) {
      await this.runWithConcurrency(filesToDelete, this.maxConcurrentTransfers, async (event) => {
        await this.deleteRemotePath(event.path, event.type === 'unlinkDir');
      });
    }

    const deletedCount = this.config.deleteRemoteFiles ? filesToDelete.length : 0;
    return directoriesToCreate.length + filesToSync.length + deletedCount;
  }

  /**
   * Full deploy with SCP
   */
  private async fullScpDeploy(): Promise<number> {
    const files = await this.collectFilesForFullDeploy();
    if (files.length === 0) return 0;

    await this.runWithConcurrency(files, this.maxConcurrentTransfers, async (filePath) => {
      await this.scpFile(filePath);
    });

    return files.length;
  }

  /**
   * Collect files for full deploy while respecting ignore and git tracking options
   */
  private async collectFilesForFullDeploy(): Promise<string[]> {
    const sourceBase = resolve(this.config.source);
    const ignoreFilter = new IgnoreFilter(
      sourceBase,
      this.config.ignorePatterns || [],
      this.config.excludeFromGitIgnore !== false
    );

    const files: string[] = [];
    const stack: string[] = [sourceBase];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) continue;

      const entries = readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const absolutePath = join(current, entry.name);
        const relativePath = this.normalizeRemotePath(relative(sourceBase, absolutePath));

        if (ignoreFilter.shouldIgnore(relativePath)) {
          continue;
        }

        if (entry.isDirectory()) {
          stack.push(absolutePath);
        } else if (entry.isFile()) {
          files.push(relativePath);
        }
      }
    }

    if (this.config.useGitTracking) {
      const tracker = new GitTracker(sourceBase);
      const tracked = new Set((await tracker.getTrackedFiles()).map((f) => this.normalizeRemotePath(f)));
      return files.filter((file) => tracked.has(file));
    }

    return files;
  }

  /**
   * Copy single file with SCP
   */
  private async scpFile(filePath: string): Promise<void> {
    const sourcePath = join(this.config.source, filePath);
    
    if (!existsSync(sourcePath)) {
      throw new Error(`File not found: ${sourcePath}`);
    }

    const normalizedPath = this.normalizeRemotePath(filePath);
    const remotePath = posix.join(this.config.destination, normalizedPath);
    const remoteDir = posix.dirname(remotePath);

    await this.ensureRemoteDirectory(remoteDir);

    const args = [
      '-P', String(this.config.port || 22)
    ];

    const privateKeyPath = this.resolvePrivateKeyPath();
    if (privateKeyPath) {
      args.push('-i', privateKeyPath);
    }

    args.push(
      sourcePath,
      `${this.config.username}@${this.config.host}:${remotePath}`
    );

    await this.execCommand('scp', args, `scp failed for ${filePath}`);
  }

  /**
   * Ensure remote directory exists
   */
  private async ensureRemoteDirectory(remoteDir: string): Promise<void> {
    const command = `mkdir -p ${this.shellQuote(remoteDir)}`;
    await this.sshExec(command);
  }

  /**
   * Delete path on remote server
   */
  private async deleteRemotePath(relativePath: string, isDir: boolean): Promise<void> {
    const normalizedPath = this.normalizeRemotePath(relativePath);
    const remotePath = posix.join(this.config.destination, normalizedPath);
    const command = isDir
      ? `rm -rf ${this.shellQuote(remotePath)}`
      : `rm -f ${this.shellQuote(remotePath)}`;

    await this.sshExec(command);
  }

  /**
   * Execute command via SSH
   */
  private async sshExec(command: string): Promise<void> {
    const args = [
      ...this.buildSshBaseArgs(),
      `${this.config.username}@${this.config.host}`,
      command
    ];

    await this.execCommand('ssh', args, 'SSH command failed');
  }

  /**
   * Common SSH args
   */
  private buildSshBaseArgs(): string[] {
    const args = ['-p', String(this.config.port || 22), '-o', 'BatchMode=yes'];

    const privateKeyPath = this.resolvePrivateKeyPath();
    if (privateKeyPath) {
      args.push('-i', privateKeyPath);
    }

    return args;
  }

  /**
   * Resolve SSH private key path (supports ~/)
   */
  private resolvePrivateKeyPath(): string | undefined {
    const rawPath = this.config.privateKeyPath?.trim();
    if (!rawPath) return undefined;

    if (rawPath === '~') {
      return homedir();
    }

    if (rawPath.startsWith('~/')) {
      return resolve(homedir(), rawPath.slice(2));
    }

    return resolve(rawPath);
  }

  /**
   * Execute child process with captured stderr
   */
  private async execCommand(bin: string, args: string[], errorPrefix: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn(bin, args, { stdio: 'pipe' });
      let errorOutput = '';

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`${errorPrefix}: ${errorOutput || `exit code ${code}`}`));
        }
      });

      child.on('error', (error) => {
        reject(new Error(`${errorPrefix}: ${error.message}`));
      });
    });
  }

  /**
   * Run array jobs with concurrency limit
   */
  private async runWithConcurrency<T>(
    items: T[],
    concurrency: number,
    worker: (item: T) => Promise<void>
  ): Promise<void> {
    if (items.length === 0) return;

    let index = 0;
    const workers = new Array(Math.min(concurrency, items.length)).fill(0).map(async () => {
      while (index < items.length) {
        const currentIndex = index;
        index += 1;
        await worker(items[currentIndex]);
      }
    });

    await Promise.all(workers);
  }

  /**
   * Normalize file path for remote POSIX shells
   */
  private normalizeRemotePath(pathValue: string): string {
    return pathValue.replace(/\\/g, '/').replace(/^\.\//, '');
  }

  /**
   * Quote value for safe single-quoted shell usage
   */
  private shellQuote(value: string): string {
    return `'${value.replace(/'/g, `'\\''`)}'`;
  }

  /**
   * Test connection to remote server
   */
  async testConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      const args = [
        ...this.buildSshBaseArgs(),
        '-o', 'ConnectTimeout=5',
        '-o', 'StrictHostKeyChecking=accept-new'
      ];

      args.push(
        `${this.config.username}@${this.config.host}`,
        'echo "Connection successful"'
      );

      const ssh = spawn('ssh', args, { stdio: 'pipe' });

      ssh.on('close', (code) => {
        resolve(code === 0);
      });

      ssh.on('error', () => {
        resolve(false);
      });
    });
  }
}
