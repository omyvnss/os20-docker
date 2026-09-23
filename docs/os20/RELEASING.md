# Releasing an OS20 update

## Why versions matter

Existing installs run `upgrade` on every boot. The runner does not look for
missed steps. It finds the most recent row in `core."upgradeMigration"` and
resumes right after it. The sequence is ordered by version, then fast instance
commands, slow instance commands, workspace commands, each by timestamp.

So a command added to a version that installs already ran is never executed on
them, whatever its timestamp. Schema only reaches existing installs through a
new version.

## Steps

1. Bump the version (from `packages/twenty-server`):

   ```bash
   npx tsx scripts/bump-version.ts 2.38.0
   ```

   This moves the old current version into `TWENTY_PREVIOUS_VERSIONS` (and so
   into the cross-upgrade list) and sets `TWENTY_CURRENT_VERSION`.

2. Freeze the version you just moved: add its step names to
   `src/engine/core-modules/upgrade/constants/released-upgrade-steps.constant.ts`.
   The spec `upgrade/__tests__/released-upgrade-steps.spec.ts` fails until you
   do, and fails if anyone later adds a step to a frozen version.

3. Put new schema commands only in the new version folder, for example
   `src/database/commands/upgrade-version-command/2-38/`:
   - Fast instance commands: `@RegisteredInstanceCommand('2.38.0', <now in ms>)`,
     then add the class to `instance-commands.constant.ts`.
   - Workspace commands: add them to a `2-38-upgrade-version-command.module.ts`
     and import that module in `workspace-command-provider.module.ts`.
   - Write DDL idempotently (`CREATE TABLE IF NOT EXISTS`,
     `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`). Never drop or
     rewrite user data without a backfill.

4. Never insert into, rename or remove a step of a released version. If a
   released command was wrong, ship a new corrective command in the new
   version.

5. Upstream Twenty merges: upstream also uses these version numbers. Move any
   upstream command for a version OS20 already released into the current OS20
   version before merging.

6. Verify:

   ```bash
   cd packages/twenty-server
   npx jest --config jest.config.mjs src/engine/core-modules/upgrade
   npx jest --config jest.config.mjs src/database/commands/upgrade-version-command
   cd ../.. && NODE_OPTIONS=--max-old-space-size=3072 npx nx typecheck twenty-server --parallel=1
   ```

7. Build and tag the images (CI does this from `.github/workflows/images.yml`,
   target `twenty` only):

   ```bash
   docker build --target twenty --build-arg APP_VERSION=2.38.0 \
     -t ghcr.io/omyvnss/os20:latest -t ghcr.io/omyvnss/os20:2.38.0 \
     -f packages/twenty-docker/twenty/Dockerfile .
   ```

   Rebuild `os20-leadgen` too if `services/os20-leadgen` changed. Push, then tag
   the release in git.

## What users do

- `os20 update`: dumps the database to `~/.os20/backups` (last 5 kept), pulls
  the new images and restarts. The `os20` container runs `upgrade` on boot and
  the worker waits for it to be healthy.
- Or re-run `install.sh`, which also backs up before pulling.
- Restore with `os20 restore <file>` if an update goes wrong.
