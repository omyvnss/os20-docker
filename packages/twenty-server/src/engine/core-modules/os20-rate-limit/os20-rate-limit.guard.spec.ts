import { HttpException, HttpStatus } from '@nestjs/common';
import { type ExecutionContext } from '@nestjs/common';
import { type Reflector } from '@nestjs/core';

import { Os20RateLimitGuard } from 'src/engine/core-modules/os20-rate-limit/os20-rate-limit.guard';
import {
  ThrottlerException,
  ThrottlerExceptionCode,
} from 'src/engine/core-modules/throttler/throttler.exception';
import { type ThrottlerService } from 'src/engine/core-modules/throttler/throttler.service';

const buildContext = (request: object) =>
  ({
    getHandler: () => () => undefined,
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

const options = { name: 'lead-find', max: 10, windowMs: 60_000 };

const buildGuard = (throttle: jest.Mock, limits: object | null = options) =>
  new Os20RateLimitGuard(
    { get: () => limits } as unknown as Reflector,
    { tokenBucketThrottleOrThrow: throttle } as unknown as ThrottlerService,
  );

describe('Os20RateLimitGuard', () => {
  it('keys the bucket by workspace', async () => {
    const throttle = jest.fn().mockResolvedValue(9);

    await expect(
      buildGuard(throttle).canActivate(
        buildContext({ workspace: { id: 'ws-1' }, ip: '127.0.0.1' }),
      ),
    ).resolves.toBe(true);
    expect(throttle).toHaveBeenCalledWith(
      'os20-rate-limit:lead-find:ws-1',
      1,
      10,
      60_000,
    );
  });

  it('returns 429 when the bucket is empty', async () => {
    const throttle = jest
      .fn()
      .mockRejectedValue(
        new ThrottlerException('full', ThrottlerExceptionCode.LIMIT_REACHED),
      );

    const result = buildGuard(throttle).canActivate(
      buildContext({ ip: '127.0.0.1' }),
    );

    await expect(result).rejects.toBeInstanceOf(HttpException);
    await expect(result).rejects.toMatchObject({
      status: HttpStatus.TOO_MANY_REQUESTS,
    });
  });

  it('lets the request through when the cache is down', async () => {
    const throttle = jest.fn().mockRejectedValue(new Error('redis down'));

    await expect(
      buildGuard(throttle).canActivate(buildContext({ ip: '127.0.0.1' })),
    ).resolves.toBe(true);
  });

  it('does nothing on routes without a limit', async () => {
    const throttle = jest.fn();

    await expect(
      buildGuard(throttle, null).canActivate(buildContext({})),
    ).resolves.toBe(true);
    expect(throttle).not.toHaveBeenCalled();
  });
});
