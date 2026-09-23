import { Injectable, Logger } from '@nestjs/common';

import { FieldActorSource } from 'twenty-shared/types';

import { transformRichTextValue } from 'src/engine/core-modules/record-transformer/utils/transform-rich-text.util';
import { WorkspaceOrmManager } from 'src/engine/twenty-orm/workspace-orm.manager';
import { buildSystemAuthContext } from 'src/engine/twenty-orm/utils/build-system-auth-context.util';
import { NoteTargetWorkspaceEntity } from 'src/modules/note/standard-objects/note-target.workspace-entity';
import { NoteWorkspaceEntity } from 'src/modules/note/standard-objects/note.workspace-entity';

const escapeMarkdown = (text: string): string =>
  text.replace(/([\\`*_[\]#<>])/g, '\\$1');

export const buildSentEmailNoteMarkdown = ({
  from,
  to,
  subject,
  body,
}: {
  from: string;
  to: string;
  subject: string;
  body: string;
}): string =>
  [
    `**From:** ${escapeMarkdown(from)}`,
    `**To:** ${escapeMarkdown(to)}`,
    `**Subject:** ${escapeMarkdown(subject)}`,
    '',
    escapeMarkdown(body),
  ].join('\n\n');

@Injectable()
export class Os20EmailNoteService {
  private readonly logger = new Logger(Os20EmailNoteService.name);

  constructor(private readonly workspaceOrmManager: WorkspaceOrmManager) {}

  async logSentEmail({
    workspaceId,
    personId,
    from,
    to,
    subject,
    body,
  }: {
    workspaceId: string;
    personId: string;
    from: string;
    to: string;
    subject: string;
    body: string;
  }): Promise<string | null> {
    try {
      const bodyV2 = await transformRichTextValue({
        markdown: buildSentEmailNoteMarkdown({ from, to, subject, body }),
        blocknote: null,
      });

      return await this.workspaceOrmManager.executeInWorkspaceContext(
        async () => {
          const noteRepository = this.workspaceOrmManager.getRepository(
            NoteWorkspaceEntity,
            { shouldBypassPermissionChecks: true },
          );
          const noteTargetRepository = this.workspaceOrmManager.getRepository(
            NoteTargetWorkspaceEntity,
            { shouldBypassPermissionChecks: true },
          );

          const inserted = await noteRepository.insert({
            title: `Email sent: ${subject}`.slice(0, 255),
            bodyV2,
            position: 0,
            createdBy: {
              source: FieldActorSource.SYSTEM,
              workspaceMemberId: null,
              name: 'OS20 Outreach',
              context: {},
            },
          });
          const noteId = (inserted.raw as { id?: string }[] | undefined)?.[0]
            ?.id;

          if (!noteId) return null;

          await noteTargetRepository.insert({
            noteId,
            targetPersonId: personId,
          });

          return noteId;
        },
        buildSystemAuthContext(workspaceId),
      );
    } catch (error) {
      this.logger.warn(`Email sent but the note could not be saved: ${error}`);

      return null;
    }
  }
}
