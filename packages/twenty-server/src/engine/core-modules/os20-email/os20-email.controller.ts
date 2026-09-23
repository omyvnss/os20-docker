import {
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';

import { UserInputError } from 'src/engine/core-modules/graphql/utils/graphql-errors.util';
import {
  Os20EmailError,
  type Os20EmailErrorCode,
  Os20EmailService,
} from 'src/engine/core-modules/os20-email/services/os20-email.service';
import {
  Os20EmailValidationError,
  parseSendInput,
  parseSmtpInput,
} from 'src/engine/core-modules/os20-email/utils/os20-email-rules.util';
import { type WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthUserWorkspaceId } from 'src/engine/decorators/auth/auth-user-workspace-id.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { JwtAuthGuard } from 'src/engine/guards/jwt-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { ConnectedAccountException } from 'src/engine/metadata-modules/connected-account/connected-account.exception';

const STATUS_BY_CODE: Record<Os20EmailErrorCode, HttpStatus> = {
  NO_SENDER: HttpStatus.BAD_REQUEST,
  PERSON_NOT_FOUND: HttpStatus.NOT_FOUND,
  NO_EMAIL: HttpStatus.BAD_REQUEST,
  INVALID_EMAIL: HttpStatus.BAD_REQUEST,
  NEEDS_CONFIRMATION: HttpStatus.CONFLICT,
  LIMIT_REACHED: HttpStatus.TOO_MANY_REQUESTS,
  SEND_FAILED: HttpStatus.BAD_GATEWAY,
};

export const toOs20EmailHttpError = (error: unknown): HttpException => {
  if (error instanceof HttpException) return error;

  if (error instanceof Os20EmailError) {
    return new HttpException(
      {
        statusCode: STATUS_BY_CODE[error.code],
        code: error.code,
        message: error.message,
      },
      STATUS_BY_CODE[error.code],
    );
  }

  if (error instanceof ConnectedAccountException) {
    return new HttpException(
      {
        statusCode: HttpStatus.FORBIDDEN,
        message: 'This sender belongs to another user',
      },
      HttpStatus.FORBIDDEN,
    );
  }

  const status =
    error instanceof Os20EmailValidationError || error instanceof UserInputError
      ? HttpStatus.BAD_REQUEST
      : HttpStatus.INTERNAL_SERVER_ERROR;

  return new HttpException(
    {
      statusCode: status,
      message: error instanceof Error ? error.message : String(error),
    },
    status,
  );
};

@Controller('os20-email')
@UseGuards(JwtAuthGuard, WorkspaceAuthGuard)
export class Os20EmailController {
  constructor(private readonly os20EmailService: Os20EmailService) {}

  @Get('smtp')
  async getSmtp(@AuthWorkspace() workspace: WorkspaceEntity) {
    return this.os20EmailService.getStatus(workspace.id);
  }

  @Post('smtp')
  async saveSmtp(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUserWorkspaceId() userWorkspaceId: string,
    @Body() body: unknown,
  ) {
    try {
      return await this.os20EmailService.saveSmtp(
        workspace.id,
        userWorkspaceId,
        parseSmtpInput(body, { requirePassword: false }),
      );
    } catch (error) {
      throw toOs20EmailHttpError(error);
    }
  }

  @Delete('smtp')
  async deleteSmtp(@AuthWorkspace() workspace: WorkspaceEntity) {
    try {
      return await this.os20EmailService.deleteSmtp(workspace.id);
    } catch (error) {
      throw toOs20EmailHttpError(error);
    }
  }

  @Post('smtp/test')
  async testSmtp(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUserWorkspaceId() userWorkspaceId: string,
  ) {
    try {
      return await this.os20EmailService.sendTest(
        workspace.id,
        userWorkspaceId,
      );
    } catch (error) {
      throw toOs20EmailHttpError(error);
    }
  }

  @Post('send')
  async send(
    @AuthWorkspace() workspace: WorkspaceEntity,
    @AuthUserWorkspaceId() userWorkspaceId: string,
    @Body() body: unknown,
  ) {
    try {
      return await this.os20EmailService.sendToPerson(
        workspace.id,
        userWorkspaceId,
        parseSendInput(body),
      );
    } catch (error) {
      throw toOs20EmailHttpError(error);
    }
  }
}
