import { simpleGit, SimpleGit } from 'simple-git';
import { existsSync } from 'fs';
import { join } from 'path';

export class GitTracker {
  private git: SimpleGit;
  private isGitRepo: boolean = false;

  constructor(private baseDir: string) {
    this.git = simpleGit(baseDir);
    this.isGitRepo = existsSync(join(baseDir, '.git'));
  }

  /**
   * Check if the directory is a git repository
   */
  async isRepository(): Promise<boolean> {
    if (!this.isGitRepo) return false;

    try {
      await this.git.status();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get list of tracked files
   */
  async getTrackedFiles(): Promise<string[]> {
    if (!this.isGitRepo) return [];

    try {
      const files = await this.git.raw(['ls-files']);
      return files
        .split('\n')
        .filter(f => f.trim().length > 0)
        .map(f => f.trim());
    } catch (error) {
      console.warn('Failed to get tracked files:', error);
      return [];
    }
  }

  /**
   * Check if a file is tracked by git
   */
  async isTracked(filePath: string): Promise<boolean> {
    if (!this.isGitRepo) return false;

    try {
      const result = await this.git.raw(['ls-files', '--error-unmatch', filePath]);
      return result.trim().length > 0;
    } catch {
      return false;
    }
  }
}
