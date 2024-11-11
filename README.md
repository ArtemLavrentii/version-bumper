# Version Bumper

This is a simple script that allows automatic bump of package version in package.json for Github only ( right now ).
It will create PR to apply changes into *default* branch.

Right now it only checks for `dependencies`, and ignores `package-lock.json`/`devDependencies`/`peerDependencies`.

## How to use
1. Create .env file with GITHUB_AUTH that contains private access token, or legacy token.
   1. If you are using PAT/Fine-grained tokens then `Contents: Write` and `Pull requests: Write` permissions are required
   2. You can also load it via env-variable injection,
       but be careful with `export GITHUB_AUTH=...` as that would store it in the *sh history.

      You **must** prefix command with a space so it won't be stored in the history ( eg ` history` ),
       but that isn't universally supported ( :wave: Windows / PS ).
2. Run `npm start -- [package] [version] [owner] [repo]`
   1. `[package]` is the name of package that you are trying to update
   2. `[version]` is the new version that will be written into package.json.
       It must use strict/exact version, without ranges ( eg x.y.z, without ^ or >= syntax )
   3. `[owner]` is owner name of the repo ( eg your Org name, or personal name )
   4. `[repo]` is name of the repo

## Examples
`npm start -- semver 100.0.0 ArtemLavrentii version-bumper`

