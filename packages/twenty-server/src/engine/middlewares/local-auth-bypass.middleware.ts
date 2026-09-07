import { Injectable, type NestMiddleware } from '@nestjs/common';

import { type NextFunction, type Request, type Response } from 'express';

import { isDefined } from 'twenty-shared/utils';

@Injectable()
export class LocalAuthBypassMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const host = req.headers.host || req.hostname || '';
    const isLocalhost =
      host.includes('localhost') || host.includes('127.0.0.1');
    const skipAuth = process.env.SKIP_AUTH === 'true';

    if (isLocalhost && skipAuth && !isDefined(req.user)) {
      (req as any).__localAuthBypass = true;
    }

    next();
  }
}
