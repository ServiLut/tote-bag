import { ArgumentsHost, Catch, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { Request, Response } from 'express';
import { Prisma } from '../../generated/client/client';

const DATABASE_CONNECTION_ERROR_CODES = new Set([
  'EACCES',
  'ECONNREFUSED',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'ENOTFOUND',
  'ETIMEDOUT',
  'P1001',
  'P1002',
]);

const DATABASE_CONNECTION_ERROR_PATTERNS = [
  "can't reach database server",
  'database server',
  'connect eacces',
  'connect econnrefused',
  'connect ehostunreach',
  'connect enetunreach',
  'connect enotfound',
  'connect etimedout',
  'timed out',
];

export function isDatabaseUnavailablePrismaError(error: unknown) {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (DATABASE_CONNECTION_ERROR_CODES.has(error.code)) {
    return true;
  }

  const message = error.message.toLowerCase();
  return DATABASE_CONNECTION_ERROR_PATTERNS.some((pattern) =>
    message.includes(pattern),
  );
}

@Catch(
  Prisma.PrismaClientInitializationError,
  Prisma.PrismaClientKnownRequestError,
)
export class PrismaConnectionExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(PrismaConnectionExceptionFilter.name);

  override catch(exception: unknown, host: ArgumentsHost) {
    if (!isDatabaseUnavailablePrismaError(exception)) {
      super.catch(exception, host);
      return;
    }

    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const message =
      'Database unavailable. Verify DATABASE_URL, network access, and the database server state.';

    this.logger.error(
      `${request?.method ?? 'UNKNOWN'} ${request?.url ?? 'unknown'} -> ${message}`,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message,
      error: 'Service Unavailable',
    });
  }
}
