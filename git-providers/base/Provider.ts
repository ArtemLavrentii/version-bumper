import type { Repository } from './Repository.ts';

export interface Provider {
  getRepo(owner: string, repo: string): Promise<Repository>;
}
