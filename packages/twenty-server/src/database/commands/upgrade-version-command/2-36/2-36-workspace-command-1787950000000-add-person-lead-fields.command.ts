import { Command } from 'nest-commander';
import { STANDARD_OBJECTS } from 'twenty-shared/metadata';
import { isDefined } from 'twenty-shared/utils';

import { ProvisionedWorkspaceCommandRunner } from 'src/database/commands/command-runners/provisioned-workspace.command-runner';
import { WorkspaceIteratorService } from 'src/database/commands/command-runners/workspace-iterator.service';
import { type RunOnWorkspaceArgs } from 'src/database/commands/command-runners/workspace.command-runner';
import { ApplicationService } from 'src/engine/core-modules/application/application.service';
import { RegisteredWorkspaceCommand } from 'src/engine/core-modules/upgrade/decorators/registered-workspace-command.decorator';
import { findFlatEntityByUniversalIdentifier } from 'src/engine/metadata-modules/flat-entity/utils/find-flat-entity-by-universal-identifier.util';
import { type FlatFieldMetadata } from 'src/engine/metadata-modules/flat-field-metadata/types/flat-field-metadata.type';
import { type FlatObjectMetadata } from 'src/engine/metadata-modules/flat-object-metadata/types/flat-object-metadata.type';
import { computeTwentyStandardApplicationAllFlatEntityMaps } from 'src/engine/workspace-manager/twenty-standard-application/utils/twenty-standard-application-all-flat-entity-maps.constant';
import { WorkspaceCacheService } from 'src/engine/workspace-cache/services/workspace-cache.service';
import { WorkspaceMigrationValidateBuildAndRunService } from 'src/engine/workspace-manager/workspace-migration/services/workspace-migration-validate-build-and-run-service';

const PERSON = STANDARD_OBJECTS.person;

export const PERSON_LEAD_FIELD_UNIVERSAL_IDENTIFIERS = [
  PERSON.fields.emailStatus.universalIdentifier,
  PERSON.fields.leadSource.universalIdentifier,
];

@RegisteredWorkspaceCommand('2.36.0', 1787950000000)
@Command({
  name: 'upgrade:2-36:add-person-lead-fields',
  description:
    'Add the Person emailStatus and leadSource standard fields on existing workspaces',
})
export class AddPersonLeadFieldsCommand extends ProvisionedWorkspaceCommandRunner {
  constructor(
    protected readonly workspaceIteratorService: WorkspaceIteratorService,
    private readonly applicationService: ApplicationService,
    private readonly workspaceCacheService: WorkspaceCacheService,
    private readonly workspaceMigrationValidateBuildAndRunService: WorkspaceMigrationValidateBuildAndRunService,
  ) {
    super(workspaceIteratorService);
  }

  override async runOnWorkspace({
    workspaceId,
    options,
  }: RunOnWorkspaceArgs): Promise<void> {
    const { flatFieldMetadataMaps, flatObjectMetadataMaps } =
      await this.workspaceCacheService.getOrRecompute(workspaceId, [
        'flatFieldMetadataMaps',
        'flatObjectMetadataMaps',
      ]);

    const personObjectMetadata =
      findFlatEntityByUniversalIdentifier<FlatObjectMetadata>({
        flatEntityMaps: flatObjectMetadataMaps,
        universalIdentifier: PERSON.universalIdentifier,
      });

    if (!isDefined(personObjectMetadata)) {
      this.logger.log(
        `person object does not exist for workspace ${workspaceId}, skipping`,
      );

      return;
    }

    const missingUniversalIdentifiers =
      PERSON_LEAD_FIELD_UNIVERSAL_IDENTIFIERS.filter(
        (universalIdentifier) =>
          !isDefined(
            flatFieldMetadataMaps.byUniversalIdentifier[universalIdentifier],
          ),
      );

    if (missingUniversalIdentifiers.length === 0) {
      return;
    }

    const { twentyStandardFlatApplication } =
      await this.applicationService.findWorkspaceTwentyStandardAndCustomApplicationOrThrow(
        { workspaceId },
      );

    const { allFlatEntityMaps: standardAllFlatEntityMaps } =
      computeTwentyStandardApplicationAllFlatEntityMaps({
        now: new Date().toISOString(),
        workspaceId,
        twentyStandardApplicationId: twentyStandardFlatApplication.id,
      });

    const fieldsToCreate = missingUniversalIdentifiers.map(
      (universalIdentifier) => {
        const standardField =
          findFlatEntityByUniversalIdentifier<FlatFieldMetadata>({
            flatEntityMaps: standardAllFlatEntityMaps.flatFieldMetadataMaps,
            universalIdentifier,
          });

        if (!isDefined(standardField)) {
          throw new Error(
            `Standard application is missing person field ${universalIdentifier}`,
          );
        }

        return standardField;
      },
    );

    if (options.dryRun ?? false) {
      this.logger.log(
        `[DRY RUN] Workspace ${workspaceId}: ${fieldsToCreate.length} person lead field(s)`,
      );

      return;
    }

    const result =
      await this.workspaceMigrationValidateBuildAndRunService.validateBuildAndRunWorkspaceMigration(
        {
          isSystemBuild: true,
          workspaceId,
          applicationUniversalIdentifier:
            twentyStandardFlatApplication.universalIdentifier,
          allFlatEntityOperationByMetadataName: {
            fieldMetadata: {
              flatEntityToCreate: fieldsToCreate,
              flatEntityToDelete: [],
              flatEntityToUpdate: [],
            },
          },
        },
      );

    if (result.status === 'fail') {
      this.logger.error(
        `Failed to add person lead fields:\n${JSON.stringify(result, null, 2)}`,
      );

      throw new Error(
        `Failed to add person lead fields for workspace ${workspaceId}`,
      );
    }

    this.logger.log(`Added person lead fields for workspace ${workspaceId}`);
  }
}
