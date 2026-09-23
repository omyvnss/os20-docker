import {
  type CanActivate,
  type ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  SetMetadata,
  UseGuards,
  applyDecorators,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ThrottlerException } from 'src/engine/core-modules/throttler/throttler.exception';
import { ThrottlerService } from 'src/engine/core-modules/throttler/throttler.service';
import { getRequest } from 'src/utils/extract-request';

export type Os20RateLimitOptions = {
  name: string;
  max: number;
  windowMs: number;
};

const OS20_RATE_LIMIT = 'os20RateLimit';

@Injectable()
export class Os20RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(Os20RateLimitGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly throttlerService: ThrottlerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<Os20RateLimitOptions | undefined>(
      OS20_RATE_LIMIT,
      context.getHandler(),
    );

    if (!options) {
      return true;
    }

    const request = getRequest(context);
    const subject = request.workspace?.id ?? request.ip ?? 'anonymous';

    try {
      await this.throttlerService.tokenBucketThrottleOrThrow(
        `os20-rate-limit:${options.name}:${subject}`,
        1,
        options.max,
        options.windowMs,
      );
    } catch (error) {
      if (error instanceof ThrottlerException) {
        this.logger.warn(`Rate limit hit on ${options.name}`);
        throw new HttpException(
          'Too many requests. Wait a minute and try again.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      // A cache outage should not take the feature down with it.
      this.logger.error(
        `Rate limit check failed on ${options.name}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return true;
  }
}

export const Os20RateLimit = (options: Os20RateLimitOptions) =>
  applyDecorators(
    SetMetadata(OS20_RATE_LIMIT, options),
    UseGuards(Os20RateLimitGuard),
  );
