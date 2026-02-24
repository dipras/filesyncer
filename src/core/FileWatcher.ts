import chokidar, { FSWatcher } from 'chokidar';
import { relative } from 'path';
import type { FileChangeEvent, SyncConfig } from '../types.js';
import { IgnoreFilter } from '../utils/IgnoreFilter.js';
import { GitTracker } from '../utils/GitTracker.js';

export class FileWatcher {
  private watcher: FSWatcher | null = null;
  private ignoreFilter: IgnoreFilter;
  private gitTracker: GitTracker;
  private changeQueue: Map<string, FileChangeEvent> = new Map();
  private debounceTimer: NodeJS.Timeout | null = null;
  private debounceMs: number;
  private onChangeCallback?: (events: FileChangeEvent[]) => void;

  constructor(
    private config: SyncConfig,
    private baseDir: string
  ) {
    this.debounceMs = config.debounceMs || 1000;
    
    // Initialize filters
    const ignorePatterns = config.ignorePatterns || [];
    this.ignoreFilter = new IgnoreFilter(baseDir, ignorePatterns);
    this.gitTracker = new GitTracker(baseDir);
  }

  /**
   * Start watching files
   */
  async start(onChange: (events: FileChangeEvent[]) => void): Promise<void> {
    this.onChangeCallback = onChange;

    // Prepare ignore patterns for chokidar
    const ignored = [
      '**/node_modules/**',
      '**/.git/**',
      ...(this.config.ignorePatterns || [])
    ];

    this.watcher = chokidar.watch(this.baseDir, {
      ignored,
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100
      }
    });

    this.watcher
      .on('add', (path) => this.handleChange('add', path))
      .on('change', (path) => this.handleChange('change', path))
      .on('unlink', (path) => this.handleChange('unlink', path))
      .on('addDir', (path) => this.handleChange('addDir', path))
      .on('unlinkDir', (path) => this.handleChange('unlinkDir', path))
      .on('error', (error) => console.error('Watcher error:', error));

    console.log('File watcher started...');
  }

  /**
   * Handle file change event
   */
  private async handleChange(
    type: FileChangeEvent['type'],
    absolutePath: string
  ): Promise<void> {
    const relativePath = relative(this.baseDir, absolutePath);

    // Check if file should be ignored
    if (this.config.excludeFromGitIgnore && this.ignoreFilter.shouldIgnore(relativePath)) {
      return;
    }

    // Check git tracking if enabled
    if (this.config.useGitTracking) {
      const isTracked = await this.gitTracker.isTracked(relativePath);
      if (!isTracked && type !== 'unlink' && type !== 'unlinkDir') {
        return;
      }
    }

    // Add to queue
    const event: FileChangeEvent = {
      type,
      path: relativePath,
      timestamp: Date.now()
    };

    this.changeQueue.set(relativePath, event);

    // Debounce
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.processQueue();
    }, this.debounceMs);
  }

  /**
   * Process queued changes
   */
  private processQueue(): void {
    if (this.changeQueue.size === 0) return;

    const events = Array.from(this.changeQueue.values());
    this.changeQueue.clear();

    if (this.onChangeCallback) {
      this.onChangeCallback(events);
    }
  }

  /**
   * Stop watching
   */
  async stop(): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    console.log('File watcher stopped.');
  }

  /**
   * Get current watch status
   */
  isWatching(): boolean {
    return this.watcher !== null;
  }
}
