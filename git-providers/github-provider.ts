import { Octokit } from 'octokit';
import { env } from 'node:process';
import type { Provider } from './base/Provider.ts';
import type { Repository } from './base/Repository.ts';
import type { Branch } from './base/Branch.ts';
import type { Commit } from './base/Commit.ts';
import type { GitFile, UpdateFileArgs } from './base/GitFile.ts';

// TODO: split into files... laziness is bad, ik! :P

class GithubBasicObject {
  constructor(protected api: Octokit) {}
}

interface GithubRepoParams {
  owner: string;
  repo: string;
}

export class GithubGitFile extends GithubBasicObject implements GitFile {
  constructor(api: Octokit, private repo: GithubRepoParams, public path: string, public content: Buffer, private sha: string) {
    super(api);
  }

  async update({ targetBranch, content, message }: UpdateFileArgs): Promise<Commit> {
    const fileUpdateResult = (await this.api.rest.repos.createOrUpdateFileContents({
      ...this.repo,
      path: this.path,
      message,
      content: content.toString('base64'),
      sha: this.sha,
      branch: targetBranch.name,
    })).data.commit;
    const { sha } = fileUpdateResult;
    if (typeof sha !== 'string') {
      throw new Error('api error while creating file');
    }

    return new GithubCommit(
      this.api,
      this.repo,
      { sha },
    );
  }
}

export class GithubCommit extends GithubBasicObject implements Commit {
  public hash: string;

  constructor(api: Octokit, private repo: GithubRepoParams, { sha }: { sha: string }) {
    super(api);
    this.hash = sha;
  }
}

export class GithubBranch extends GithubBasicObject implements Branch {
  constructor(api: Octokit, private repo: GithubRepoParams, public name: string) {
    super(api);
  }

  async getLastCommit(): Promise<Commit> {
    return new GithubCommit(
      this.api,
      this.repo,
      (await this.api.rest.repos.listCommits({
        ...this.repo,
        sha: this.name,
        per_page: 1,
      })).data[0],
    );
  }
}

export class GithubRepository extends GithubBasicObject implements Repository {
  private defaultBranch: string;

  constructor(api: Octokit, private repoParams: GithubRepoParams, { default_branch: defaultBranch }: { default_branch: string }) {
    super(api);

    this.defaultBranch = defaultBranch;
  }

  getDefaultBranch(): Promise<Branch> {
    return Promise.resolve(new GithubBranch(
      this.api,
      this.repoParams,
      this.defaultBranch,
    ));
  }

  async getFile(commit: Commit, path: string): Promise<GitFile> {
    const contentData = (await this.api.rest.repos.getContent({
      ...this.repoParams,
      path,
      ref: commit.hash,
    })).data;

    if (Array.isArray(contentData) || contentData.type !== 'file') {
      throw new Error('package.json should be a file, its either a directory/submodule or symlink');
    }

    if (contentData.encoding === 'none') {
      throw new Error('package.json is bigger than 1MB, this is currently unsupported');
    }

    return new GithubGitFile(
      this.api,
      this.repoParams,
      path,
      Buffer.from(contentData.content, 'base64'),
      contentData.sha,
    );
  }

  async createBranch(fromCommit: Commit, name: string): Promise<Branch> {
    await this.api.rest.git.createRef({
      ...this.repoParams,
      ref: `refs/heads/${name}`,
      sha: fromCommit.hash,
    });

    return new GithubBranch(
      this.api,
      this.repoParams,
      name,
    );
  }

  async createPullRequest(into: Branch, pullFrom: Branch, { title }: { title: string }): Promise<void> {
    await this.api.rest.pulls.create({
      ...this.repoParams,
      title,
      head: pullFrom.name,
      base: into.name,
    })
  }

  toString() {
    return `${this.repoParams.owner}/${this.repoParams.repo}`;
  }
}

export class GithubProvider extends GithubBasicObject implements Provider {
  constructor() {
    super(new Octokit({ auth: env.GITHUB_AUTH }));
  }

  async getRepo(owner: string, repo: string): Promise<Repository> {
    return new GithubRepository(
      this.api,
      { owner, repo },
      (await this.api.rest.repos.get({ owner, repo })).data,
    );
  }
}
