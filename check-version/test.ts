import { describe, it } from 'node:test';
import type { TestContext } from 'node:test';
import { SemVer } from 'semver';

import type { Branch } from '../git-providers/base/Branch.ts';
import type { Commit } from '../git-providers/base/Commit.ts';
import type { GitFile, UpdateFileArgs } from '../git-providers/base/GitFile.ts';
import type { Repository } from '../git-providers/base/Repository.js';

import { checkVersion } from './index.ts';

import mockedPackage from './mocked-package.json' assert { type: 'json' };

// TODO: Split mocked provider into its own file as it could be useful in more than 1 test, and this file is already pretty bulky
describe('simple tests', () => {
  it('creates pr with updated file', async (t: TestContext) => {
    const latestCommit: Commit = {
      hash: 'last-commit-hash'
    };
    const updatedPackageCommit: Commit = {
      hash: 'update-package-hash'
    };
    const defaultBranch: Branch = {
      name: 'default-branch',
      getLastCommit(): Promise<Commit> {
        return Promise.resolve(latestCommit);
      }
    };
    const newBranch: Branch = {
      name: 'feat/bump-xxx',
      getLastCommit(): Promise<Commit> {
        throw new Error('Shouldn\'t be called');
      }
    };
    const packageJsonFile: GitFile = {
      content: Buffer.from(JSON.stringify(mockedPackage)),
      update(args: UpdateFileArgs): Promise<Commit> {
        // TODO: Add better asserts
        t.assert.snapshot(args);

        return Promise.resolve(updatedPackageCommit);
      },
    };

    const repo: Repository = {
      getDefaultBranch(): Promise<Branch> {
        return Promise.resolve(defaultBranch);
      },
      createBranch(fromCommit: Commit, name: string): Promise<Branch> {
        t.assert.strictEqual(fromCommit, latestCommit, 'branch must be created from latest commit');
        t.assert.strictEqual(name, 'feat/bump-xxx', 'branch name must follow feat/bump-xxx format');

        return Promise.resolve(newBranch);
      },
      getFile(commit: Commit, path: string): Promise<GitFile> {
        t.assert.strictEqual(commit, latestCommit, 'package.json should be resolved from latest commit');
        t.assert.strictEqual(path, 'package.json', 'package.json should be located in the top directory without any prefixes');

        return Promise.resolve(packageJsonFile);
      },
      createPullRequest(into: Branch, pullFrom: Branch, { title }: { title: string }): Promise<void> {
        t.assert.strictEqual(into, defaultBranch);
        t.assert.strictEqual(pullFrom, newBranch);
        t.assert.strictEqual(title, 'bump test-package');

        return Promise.resolve();
      },
    };

    t.plan(8);
    await checkVersion(
      repo,
      'test-package',
      new SemVer('1.2.3'),
    );
  });
});
