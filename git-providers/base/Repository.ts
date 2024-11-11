import type { Branch } from './Branch.ts';
import type { Commit } from './Commit.ts';
import type { GitFile } from './GitFile.ts';

export interface Repository {
  getDefaultBranch(): Promise<Branch>;
  createBranch(fromCommit: Commit, name: string): Promise<Branch>;
  getFile(commit: Commit, path: string): Promise<GitFile>;
  // TODO: Add PullRequest type
  createPullRequest(into: Branch, pullFrom: Branch, args: { title: string }): Promise<void>;
}
