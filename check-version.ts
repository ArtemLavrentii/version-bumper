import dotenv from 'dotenv';
import { Octokit } from 'octokit';
import { argv, env } from 'node:process';
import semver from 'semver';

dotenv.config();

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

if (argv.length !== 6) {
  throw new Error('npm start -- [package] [version] [owner] [repo]\nFor example: npm start -- joi 100.0.0 ArtemLavrentii p-t-task');
}

const ghClient = new Octokit({ auth: env.GITHUB_AUTH });

const [, , packageName, newPackageVersion, owner, repo] = argv;

const newSemverPackageVersion = new semver.SemVer(newPackageVersion);

const { data: { default_branch } } = await ghClient.rest.repos.get({ owner, repo });

const { data: [lastCommit] } = await ghClient.rest.repos.listCommits({
  owner,
  repo,
  sha: default_branch,
  per_page: 1,
});
const { sha: lastCommitHash } = lastCommit;

const { data: packageJsonFile } = await ghClient.rest.repos.getContent({
  owner,
  repo,
  path: 'package.json',
  ref: lastCommitHash,
});

if (Array.isArray(packageJsonFile) || packageJsonFile.type !== 'file') {
  throw new Error('package.json should be a file, its either a directory/submodule or symlink');
}

if (packageJsonFile.encoding === 'none') {
  throw new Error('package.json is bigger than 1MB, this is currently unsupported');
}
const packageJsonContent = Buffer.from(packageJsonFile.content, 'base64').toString();
let parsedPackageJson = null;
try {
  parsedPackageJson = JSON.parse(packageJsonContent);
} catch (e) {
  throw new Error('Unable to parse package.json', { cause: e });
}

if (typeof parsedPackageJson.dependencies !== 'object'
  || Array.isArray(parsedPackageJson.dependencies)) {
  throw new Error('dependencies should be an object');
}

if (!Object.hasOwn(parsedPackageJson.dependencies, packageName)) {
  throw new Error(`${owner}/${repo} currently is not dependant on ${packageName}`);
}

const currentVersionRange = new semver.Range(parsedPackageJson.dependencies[packageName], { includePrerelease: true });

// If version in package.json already requires bigger version that we ask then there is nothing for us to bump
const currentMinimalVersion = semver.minVersion(currentVersionRange);
if (currentMinimalVersion !== null && semver.gt(currentMinimalVersion, newSemverPackageVersion)) {
  throw new Error(`${owner}/${repo} already requires newer version than ${newPackageVersion}`);
}

// TODO: Support ^ / >= / 1.x-style syntax
parsedPackageJson.dependencies[packageName] = newSemverPackageVersion.toString();

await ghClient.rest.git.createRef({
  owner,
  repo,
  ref: 'refs/heads/feat/bump-xxx',
  sha: lastCommitHash,
});

await ghClient.rest.repos.createOrUpdateFileContents({
  owner,
  repo,
  path: 'package.json',
  message: `chore(node,dependencies): bump ${packageName} to ${newPackageVersion}`,
  content: Buffer.from(JSON.stringify(parsedPackageJson, undefined, 2)).toString('base64'),
  sha: packageJsonFile.sha,
  branch: 'feat/bump-xxx'
});


await ghClient.rest.pulls.create({
  owner,
  repo,
  title: `bump ${packageName}`,
  head: 'feat/bump-xxx',
  base: default_branch,
});
