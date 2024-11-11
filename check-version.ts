import type { Repository } from './git-providers/base/Repository.ts';
import semver, { SemVer } from 'semver';

// TODO: Add unit tests
// TODO: This could be refactored into 3 separate functions
//  ( Extract data from git, Transform the package.json, Load back into git )
export async function checkVersion(repo: Repository, packageName: string, packageVersion: SemVer) {
  const defaultBranch = await repo.getDefaultBranch();

  const lastCommit = await defaultBranch.getLastCommit();

  const packageJsonFile = await repo.getFile(lastCommit, 'package.json');

  const packageJsonContent = packageJsonFile.content.toString();

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
    throw new Error(`${repo} currently is not dependant on ${packageName}`);
  }

  const currentVersionRange = new semver.Range(parsedPackageJson.dependencies[packageName], { includePrerelease: true });

  // If version in package.json already requires bigger version that we ask then there is nothing for us to bump
  const currentMinimalVersion = semver.minVersion(currentVersionRange);
  if (currentMinimalVersion !== null && semver.gt(currentMinimalVersion, packageVersion)) {
    throw new Error(`${repo} already requires newer version than ${packageVersion}`);
  }

  // TODO: Support ^ / >= / 1.x-style syntax
  parsedPackageJson.dependencies[packageName] = currentVersionRange.toString();

  // TODO: Generate branch name from package; it should remove starting @ if there is any and replace / with -.
  //  Maybe other symbols would need replacing too.
  //  The person who will be fixing this should check allowed symbols in package name and compare it to allowed symbols in branch name
  const newBranchName = 'feat/bump-xxx';
  const newBranch = await repo.createBranch(lastCommit, newBranchName);

  await packageJsonFile.update(
    {
      targetBranch: newBranch,
      content: Buffer.from(JSON.stringify(parsedPackageJson, undefined, 2)),
      message: `chore(node, dependencies): bump ${packageName} to ${packageVersion}`,
    },
  );

  await repo.createPullRequest(defaultBranch, newBranch, {
    title: `bump ${packageName}`,
  });
}
