import { spawn } from 'child_process';
import { resolve, join } from 'path';
import { existsSync, statSync } from 'fs';
import type { SyncConfig, FileChangeEvent, SyncResult } from '../types.js';

export class SyncEngine {
  constructor(private config: SyncConfig) {}

  /**
   * Sync files to remote server
   */
  async sync(events?: FileChangeEvent[]): Promise<SyncResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      if (this.config.syncMethod === 'scp') {
        await this.syncWithScp(events);
      } else {
        await this.syncWithRsync(events);
      }

      const duration = Date.now() - startTime;
      return {
        success: true,
        filesChanged: events?.length || 0,
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
  private async syncWithRsync(events?: FileChangeEvent[]): Promise<void> {
    // If events provided (watch mode), sync only changed files
    if (events && events.length > 0) {
      return this.syncSpecificFiles(events);
    }
    
    // Otherwise, do full sync (deploy mode)
    const args = this.buildRsyncArgs();

    return new Promise((resolve, reject) => {
      const rsync = spawn('rsync', args, {
        stdio: 'pipe'
      });

      let output = '';
      let errorOutput = '';

      rsync.stdout.on('data', (data) => {
        output += data.toString();
      });

      rsync.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      rsync.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`rsync failed with code ${code}: ${errorOutput}`));
        }
      });

      rsync.on('error', (error) => {
        reject(new Error(`Failed to start rsync: ${error.message}`));
      });
    });
  }

  /**
   * Sync specific files only (watch mode)
   */
  private async syncSpecificFiles(events: FileChangeEvent[]): Promise<void> {
    // Filter out delete events for rsync (we don't delete by default)
    const filesToSync = events.filter(e => 
      e.type === 'add' || e.type === 'change'
    );

    if (filesToSync.length === 0) {
      return; // Nothing to sync
    }

    // Sync each file individually using rsync
    const promises = filesToSync.map(event => 
      this.rsyncSingleFile(event.path)
    );

    await Promise.all(promises);
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
    if (this.config.privateKeyPath) {
      sshArgs.push(`-i ${this.config.privateKeyPath}`);
    }
    args.push('-e', sshArgs.join(' '));

    // Source (with ./ prefix for --relative)
    const sourceBase = resolve(this.config.source);
    args.push(`${sourceBase}/./${relativePath}`);

    // Destination
    const destination = `${this.config.username}@${this.config.host}:${this.config.destination}`;
    args.push(destination);

    return new Promise((resolve, reject) => {
      const rsync = spawn('rsync', args, { stdio: 'pipe' });

      let errorOutput = '';
      rsync.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      rsync.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`rsync failed for ${relativePath}: ${errorOutput}`));
        }
      });

      rsync.on('error', (error) => {
        reject(new Error(`Failed to rsync ${relativePath}: ${error.message}`));
      });
    });
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
    if (this.config.privateKeyPath) {
      sshArgs.push(`-i ${this.config.privateKeyPath}`);
    }
    args.push('-e', sshArgs.join(' '));

    // Add exclude patterns
    const excludePatterns = this.config.ignorePatterns || [];
    for (const pattern of excludePatterns) {
      args.push('--exclude', pattern);
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
  private async syncWithScp(events?: FileChangeEvent[]): Promise<void> {
    if (!events || events.length === 0) {
      throw new Error('SCP sync requires specific file events');
    }

    // Filter out delete events (SCP can't delete)
    const filesToSync = events.filter(e => 
      e.type === 'add' || e.type === 'change'
    );

    if (filesToSync.length === 0) {
      return; // Nothing to sync
    }

    const promises = filesToSync.map(event => 
      this.scpFile(event.path)
    );

    await Promise.all(promises);
  }

  /**
   * Copy single file with SCP
   */
  private async scpFile(filePath: string): Promise<void> {
    const sourcePath = join(this.config.source, filePath);
    
    if (!existsSync(sourcePath)) {
      throw new Error(`File not found: ${sourcePath}`);
    }

    const args = [
      '-P', String(this.config.port || 22)
    ];

    if (this.config.privateKeyPath) {
      args.push('-i', this.config.privateKeyPath);
    }

    args.push(
      sourcePath,
      `${this.config.username}@${this.config.host}:${join(this.config.destination, filePath)}`
    );

    return new Promise((resolve, reject) => {
      const scp = spawn('scp', args, { stdio: 'pipe' });

      let errorOutput = '';

      scp.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      scp.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`scp failed with code ${code}: ${errorOutput}`));
        }
      });

      scp.on('error', (error) => {
        reject(new Error(`Failed to start scp: ${error.message}`));
      });
    });
  }

  /**
   * Test connection to remote server
   */
  async testConnection(): Promise<boolean> {
    return new Promise((resolve) => {
      const args = [
        '-p', String(this.config.port || 22),
        '-o', 'ConnectTimeout=5',
        '-o', 'BatchMode=yes'
      ];

      if (this.config.privateKeyPath) {
        args.push('-i', this.config.privateKeyPath);
      }

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
