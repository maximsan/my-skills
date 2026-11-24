# Does npm trusted publishing need a first manual publish?

Researched 2026-11-24 for [issue #23](https://github.com/maximsan/my-skills/issues/23).

**Trusted publishing** is npm's way to publish from CI without a stored token. The CI job proves who it is with a short-lived OIDC token from GitHub Actions. npm then lets that exact repo and workflow publish.

## Answer

Yes. A brand-new package must exist on npm before trusted publishing can publish it. The first version has to go up another way.

- `npm trust` configures a trusted publisher from the command line. Its docs list a prerequisite: "The package you're configuring must already exist on the npm registry." ([npm trust](https://docs.npmjs.com/cli/v11/commands/npm-trust))
- The web setup is also per package. It starts from "your package settings on npmjs.com". ([Trusted publishing](https://docs.npmjs.com/trusted-publishers))
- Since 2026-10-02, `npm stage publish` can create a new package. Staged publishing uploads a version that stays uninstallable until a maintainer approves it. The listed ways to sign in are a local session or a granular access token, including a stage-only token. OIDC is not among them. ([GitHub changelog](https://github.blog/changelog/2026-10-02-npm-staged-publishing-now-supports-creating-new-packages/))
- The same post says: "After package creation, you can manage its settings and configure trusted publishing." ([GitHub changelog](https://github.blog/changelog/2026-10-02-npm-staged-publishing-now-supports-creating-new-packages/))
- A new trusted publisher configuration must publish successfully within 2 days. Otherwise it expires and must be created again. ([Trusted publishing](https://docs.npmjs.com/trusted-publishers))
- Trusted publishing needs npm CLI 11.5.1 or later and Node 22.14.0 or later. `npm trust` needs npm 11.15.0 or later. ([Trusted publishing](https://docs.npmjs.com/trusted-publishers), [npm trust](https://docs.npmjs.com/cli/v11/commands/npm-trust))

None of these pages singles out scoped packages, so the rule applies to `@maximsan/...` the same way.

So a new `@maximsan/...` package needs two steps:

1. Create the package once, from a laptop or with a token. Either use `npm publish`, or use `npm stage publish` and approve the staged version.
2. Add the trusted publisher on npmjs.com (or with `npm trust`). Then publish the next version from CI within 2 days.

## How use-user-location did its first publish

`use-user-location` is the owner's published React hook package. Its first publish was manual, not trusted publishing.

- Before 2026-06-23, `release.yml` authenticated with an `NPM_TOKEN` secret and checked it with `npm whoami` (commit `cbbf08d`).
- Release run [28038280900](https://github.com/maximsan/use-user-location/actions/runs/28038280900) started at 15:48:09 UTC on 2026-06-23. It failed at the Changesets publish step after 41 seconds. Its logs have expired.
- npm records the package as created at 15:50:48 UTC, about two minutes after that run ended (`npm view use-user-location time --json`). Version 1.0.0 is the only version.
- Version 1.0.0 has no provenance attestation (`npm view use-user-location dist.attestations` is empty). npm adds provenance automatically on every trusted publish ([Trusted publishing](https://docs.npmjs.com/trusted-publishers)). So 1.0.0 was published with a token or a local login.
- At 16:07:47 UTC, commit `76b6c64` ("chore: update ci/cd pipeline") removed `NPM_TOKEN` and switched `release.yml` to trusted publishing. Its run [28039527545](https://github.com/maximsan/use-user-location/actions/runs/28039527545) passed; nothing new was published.

Not recorded: whether 1.0.0 came from a laptop or from a token. My guess is a laptop `npm publish` right after the CI run failed, because no other release run exists in that window.

The current `release.yml` keeps `id-token: write`, pins Node 24 and has no `NPM_TOKEN`. A comment in it says the trusted publisher must be configured on npmjs.com first.
