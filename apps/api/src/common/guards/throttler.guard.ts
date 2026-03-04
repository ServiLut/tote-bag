import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected getTracker(req: {
    ip: string;
    user?: { id: string };
  }): Promise<string> {
    // Rate limit by authenticated user id
    if (req.user?.id) {
      return Promise.resolve(`user-${req.user.id}`);
    }
    // Rate limit by IP for anonymous users
    return Promise.resolve(req.ip);
  }

  protected throwThrottlingException(): Promise<void> {
    throw new HttpException(
      {
        success: false,
        message:
          'Has excedido el límite de peticiones permitido. Por favor, inténtalo de nuevo más tarde.',
        error: 'Too Many Requests',
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
