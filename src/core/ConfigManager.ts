import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import type { SyncConfig } from '../types.js';

export class ConfigManager {
  private configPath: string;
  private config: SyncConfig | null = null;

  constructor(configPath?: string) {
    this.configPath = configPath || join(process.cwd(), 'sync.json');
  }

  /**
   * Load configuration from file
   */
  load(): SyncConfig {
    if (!existsSync(this.configPath)) {
      throw new Error(`Config file not found: ${this.configPath}\nRun 'filesyncer init' to create one.`);
    }

    try {
      const content = readFileSync(this.configPath, 'utf-8');
      this.config = JSON.parse(content);
      this.validate(this.config!);
      return this.config!;
    } catch (error) {
      throw new Error(`Failed to load config: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Save configuration to file
   */
  save(config: SyncConfig): void {
    this.validate(config);
    try {
      writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf-8');
      this.config = config;
    } catch (error) {
      throw new Error(`Failed to save config: ${error instanceof Error ? error.message : error}`);
    }
  }

  /**
   * Create default configuration
   */
  createDefault(): SyncConfig {
    const defaultConfig: SyncConfig = {
      source: '.',
      destination: '/var/www/app',
      host: 'example.com',
      username: 'user',
      port: 22,
      privateKeyPath: '~/.ssh/id_rsa',
      ignorePatterns: ['node_modules/**', 'dist/**', '.git/**'],
      useGitTracking: false,
      debounceMs: 1000,
      syncMethod: 'rsync',
      excludeFromGitIgnore: true,
      deleteRemoteFiles: false
    };

    this.save(defaultConfig);
    return defaultConfig;
  }

  /**
   * Validate configuration
   */
  private validate(config: SyncConfig): void {
    const required = ['source', 'destination', 'host', 'username'];
    for (const field of required) {
      if (!config[field as keyof SyncConfig]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    if (config.syncMethod && !['rsync', 'scp'].includes(config.syncMethod)) {
      throw new Error('syncMethod must be either "rsync" or "scp"');
    }

    if (config.port && (config.port < 1 || config.port > 65535)) {
      throw new Error('port must be between 1 and 65535');
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): SyncConfig | null {
    return this.config;
  }

  /**
   * Check if config file exists
   */
  exists(): boolean {
    return existsSync(this.configPath);
  }
}
