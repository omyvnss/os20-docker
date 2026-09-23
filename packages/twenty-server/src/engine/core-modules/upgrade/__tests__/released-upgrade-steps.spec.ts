import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';

import { RELEASED_UPGRADE_STEPS } from 'src/engine/core-modules/upgrade/constants/released-upgrade-steps.constant';
import { TWENTY_ALL_VERSIONS } from 'src/engine/core-modules/upgrade/constants/twenty-all-versions.constant';
import { TWENTY_CURRENT_VERSION } from 'src/engine/core-modules/upgrade/constants/twenty-current-version.constant';
import { TWENTY_PREVIOUS_VERSIONS } from 'src/engine/core-modules/upgrade/constants/twenty-previous-versions.constant';

type DeclaredUpgradeCommand = {
  kind: 'instance' | 'workspace';
  version: string;
  className: string;
  name: string;
  file: string;
};

const UPGRADE_COMMANDS_DIR = resolve(
  __dirname,
  '../../../../database/commands/upgrade-version-command',
);

const DECORATED_CLASS_PATTERN =
  /@Registered(Instance|Workspace)Command\(\s*'([0-9.]+)',\s*(\d+)(?:,\s*\{[^}]*\})?\s*\)[\s\S]*?export\s+class\s+(\w+)/g;

const listSourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const entryPath = join(directory, entry);

    if (statSync(entryPath).isDirectory()) {
      return entry === '__tests__' ? [] : listSourceFiles(entryPath);
    }

    return entry.endsWith('.ts') && !entry.endsWith('.spec.ts')
      ? [entryPath]
      : [];
  });

const collectDeclaredUpgradeCommands = (): DeclaredUpgradeCommand[] =>
  listSourceFiles(UPGRADE_COMMANDS_DIR).flatMap((file) =>
    [...readFileSync(file, 'utf8').matchAll(DECORATED_CLASS_PATTERN)].map(
      ([, kind, version, timestamp, className]) => ({
        kind:
          kind === 'Instance' ? ('instance' as const) : ('workspace' as const),
        version,
        className,
        name: `${version}_${className}_${timestamp}`,
        file: relative(UPGRADE_COMMANDS_DIR, file),
      }),
    ),
  );

const declaredCommands = collectDeclaredUpgradeCommands();

const containsIdentifier = (source: string, identifier: string) =>
  new RegExp(`\\b${identifier}\\b`).test(source);

describe('released upgrade steps', () => {
  it('finds the declared upgrade commands', () => {
    expect(declaredCommands.length).toBeGreaterThan(0);
  });

  it('declares every command against a known version', () => {
    const unknownVersionCommands = declaredCommands
      .filter(
        (command) =>
          !(TWENTY_ALL_VERSIONS as readonly string[]).includes(command.version),
      )
      .map((command) => command.file);

    expect(unknownVersionCommands).toEqual([]);
  });

  it('records a frozen step list for every released version', () => {
    const versionsMissingFromManifest = TWENTY_PREVIOUS_VERSIONS.filter(
      (version) => !(version in RELEASED_UPGRADE_STEPS),
    );

    expect(versionsMissingFromManifest).toEqual([]);
  });

  it.each([...TWENTY_PREVIOUS_VERSIONS])(
    'never changes the steps of released version %s',
    (version) => {
      const declaredNames = declaredCommands
        .filter((command) => command.version === version)
        .map((command) => command.name)
        .sort();

      const releasedNames = [...(RELEASED_UPGRADE_STEPS[version] ?? [])].sort();

      const addedAfterRelease = declaredNames.filter(
        (name) => !releasedNames.includes(name),
      );
      const removedAfterRelease = releasedNames.filter(
        (name) => !declaredNames.includes(name),
      );

      // Existing installs resume from their last executed step, so a step
      // added here is skipped on them. Move it to an unreleased version.
      expect({ version, addedAfterRelease, removedAfterRelease }).toEqual({
        version,
        addedAfterRelease: [],
        removedAfterRelease: [],
      });
    },
  );

  it('does not freeze versions that are not released yet', () => {
    const frozenUnreleasedVersions = Object.keys(RELEASED_UPGRADE_STEPS).filter(
      (version) =>
        !(TWENTY_PREVIOUS_VERSIONS as readonly string[]).includes(version) &&
        version !== TWENTY_CURRENT_VERSION,
    );

    expect(frozenUnreleasedVersions).toEqual([]);
  });

  it('registers every instance command in INSTANCE_COMMANDS', () => {
    const instanceCommandsSource = readFileSync(
      join(UPGRADE_COMMANDS_DIR, 'instance-commands.constant.ts'),
      'utf8',
    );

    const unregistered = declaredCommands
      .filter(
        (command) =>
          command.kind === 'instance' &&
          !new RegExp(`^\\s+${command.className},$`, 'm').test(
            instanceCommandsSource,
          ),
      )
      .map((command) => command.file);

    expect(unregistered).toEqual([]);
  });

  it('registers every workspace command in an imported version module', () => {
    const providerModuleSource = readFileSync(
      join(UPGRADE_COMMANDS_DIR, 'workspace-command-provider.module.ts'),
      'utf8',
    );

    const unregistered = declaredCommands
      .filter((command) => command.kind === 'workspace')
      .filter((command) => {
        const versionDirectory = join(
          UPGRADE_COMMANDS_DIR,
          command.file.split('/')[0],
        );
        const moduleFile = readdirSync(versionDirectory).find((entry) =>
          entry.endsWith('-upgrade-version-command.module.ts'),
        );

        if (moduleFile === undefined) {
          return true;
        }

        const moduleSource = readFileSync(
          join(versionDirectory, moduleFile),
          'utf8',
        );
        const moduleClassName = moduleSource.match(/export class (\w+)/)?.[1];

        return (
          moduleClassName === undefined ||
          !containsIdentifier(providerModuleSource, moduleClassName) ||
          !containsIdentifier(moduleSource, command.className)
        );
      })
      .map((command) => command.file);

    expect(unregistered).toEqual([]);
  });
});
