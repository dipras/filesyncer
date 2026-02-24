export interface SyncConfig {
  source: string;
  destination: string;
  host: string;
  username: string;
  port?: number;
  privateKeyPath?: string;
  ignorePatterns?: string[];
  useGitTracking?: boolean;
  debounceMs?: number;
  syncMethod?: 'rsync' | 'scp';
  excludeFromGitIgnore?: boolean;
}

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';
  path: string;
  timestamp: number;
}

export interface SyncResult {
  success: boolean;
  filesChanged: number;
  errors?: string[];
  duration: number;
}
