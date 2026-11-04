# Publishing LazyTrae to npm

The public package is `lazytrae` on `https://registry.npmjs.org/`. Its payload
includes `bin/lazytrae.js` and the generated `plugins/lazytrae` runtime. Users
install the package globally, then run `lazytrae install` to register the plugin.
No npm installation lifecycle script registers plugins or trusts hooks.

## Release a version

1. Update the version in `package.json` and `package-lock.json` together, then
   run `npm run build`. The generated plugin manifest must use the same version.
2. Run `npm test` and, with TRAE CLI available, `npm run test:host`. The host
   test installs an npm tarball into an isolated global prefix and exercises the
   installed executable, native plugin registration, refresh and removal.
3. Review `npm pack --dry-run`, commit the source and generated payload, and
   push the release commit. Keep credentials and local evidence outside the pack.
4. Authenticate with `npm login --registry=https://registry.npmjs.org/` and
   confirm the publishing account with `npm whoami` against the same registry.
5. Publish with `npm publish`. `publishConfig` fixes the target to the public
   registry and access to public. `prepublishOnly` rebuilds and runs the root
   tests before publishing from the source checkout.
6. Verify `npm view lazytrae@VERSION version dist.integrity dist-tags --json
   --registry=https://registry.npmjs.org/`, then install that version in a clean
   prefix and run the installed `lazytrae --version`, `install` and `doctor`.
7. Tag the verified release as `vVERSION` and push the tag.

For a reviewed tarball, run `npm pack --pack-destination <release-dir>` after
the checks, then publish that exact file with `npm publish <tarball>
--ignore-scripts --registry=https://registry.npmjs.org/`. Lifecycle checks have
already been run on the source; publishing the tarball preserves the verified
bytes. npm may require an interactive second-factor challenge for publication.

Published versions are immutable. Fix release defects by publishing a new
version rather than changing the contents of an existing version.

For future CI publication, npm supports [trusted publishers](https://docs.npmjs.com/trusted-publishers/)
with GitHub Actions OIDC. Configure the package's trusted publisher in npm before
enabling a fork-owned publishing workflow. Upstream publishing workflows remain
disabled; no npm tokens belong in this repository.
