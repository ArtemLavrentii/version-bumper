// TODO: Some things that could be improved:
//   - package-lock.json support
//   - We should check if branch already exists, and if it does then update it
//   - Retry on common errors ( eg missing commit )
//   - Better handling of expired github tokens
//   - File read/write could be implemented via git protocol instead of github-specific apis, only PR creation is vendor-specific ( eg github/gitlab/bitbucket/etc ). Some even support creation of prs over git ( see https://docs.gitlab.com/ee/topics/git/commit.html , some other platforms support this aswell )
//   - Support for github enterprise/custom base url
//   - Support for non-default branches
//   - >1MB package.json file support
//   - package.json isn't formatted in same way as npm does it, we might change line endings/indentation/etc. This needs more research ( or just use npm pkg set, now sure how safe that command is with regards to untrusted inputs )
//   - Custom file location, custom commit message, multiple files per pero
//   - Better error messages for common errors ( eg non-existent repo/not adequate permissions )
//   - Automatic forking of repositories and creation of PR from forked repository when write permission isn't set
//   -

import dotenv from 'dotenv';
dotenv.config();

import { argv } from 'node:process';
import semver from 'semver';

import { GithubProvider } from '../git-providers/github-provider.ts';
import { checkVersion } from '../check-version.ts';

if (argv.length !== 6) {
  throw new Error('npm start -- [package] [version] [owner] [repo]\nFor example: npm start -- semver 100.0.0 ArtemLavrentii version-bumper');
}

const provider = new GithubProvider();

const [, , packageName, newPackageVersion, ownerName, repoName] = argv;

await checkVersion(
  await provider.getRepo(ownerName, repoName),
  packageName,
  new semver.SemVer(newPackageVersion),
);
