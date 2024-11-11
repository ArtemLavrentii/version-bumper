import type { Commit } from './Commit.ts';

export interface Branch {
  name: string;
  getLastCommit(): Promise<Commit>;
}
