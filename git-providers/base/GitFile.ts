import type { Commit } from './Commit.ts';
import type { Branch } from './Branch.ts';

export interface UpdateFileArgs {
  targetBranch: Branch;
  content: Buffer;
  message: string;
}

export interface GitFile {
  content: Buffer;

  update(args: UpdateFileArgs): Promise<Commit>;
}
