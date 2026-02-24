import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import ignore from 'ignore';

export class IgnoreFilter {
  private ig: ReturnType<typeof ignore>;

  constructor(baseDir: string, customPatterns: string[] = []) {
    this.ig = ignore();

    // Add custom patterns
    if (customPatterns.length > 0) {
      this.ig.add(customPatterns);
    }

    // Load .gitignore if exists
    const gitignorePath = join(baseDir, '.gitignore');
    if (existsSync(gitignorePath)) {
      try {
        const gitignoreContent = readFileSync(gitignorePath, 'utf-8');
        this.ig.add(gitignoreContent);
      } catch (error) {
        console.warn('Failed to read .gitignore:', error);
      }
    }

    // Always ignore .git directory
    this.ig.add(['.git', '.git/**']);
  }

  /**
   * Check if a file should be ignored
   */
  shouldIgnore(path: string): boolean {
    // Normalize path separators
    const normalizedPath = path.replace(/\\/g, '/');
    return this.ig.ignores(normalizedPath);
  }

  /**
   * Filter an array of paths
   */
  filter(paths: string[]): string[] {
    return paths.filter(path => !this.shouldIgnore(path));
  }
}
