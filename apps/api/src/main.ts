import './instrument';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger, VersioningType } from '@nestjs/common';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { json, urlencoded, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import helmet from 'helmet';
import { winstonConfig } from './common/logger/winston.config';

type RequestWithCorrelation = Request & {
  requestId?: string;
  correlationId?: string;
};

type CorsOriginCallback = (err: Error | null, allow?: boolean) => void;
const localDevOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: winstonConfig,
  });

  const logger = new Logger('HTTP');
  const bodyLimit = process.env.JSON_BODY_LIMIT?.trim() || '256kb';

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  const httpAdapter = app.getHttpAdapter().getInstance() as any;
  httpAdapter.set('trust proxy', 1);

  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  app.use((req: RequestWithCorrelation, res: Response, next: NextFunction) => {
    const forwardedRequestId =
      req.get('x-request-id')?.trim() ||
      req.get('x-correlation-id')?.trim() ||
      randomUUID();

    req.requestId = forwardedRequestId;
    req.correlationId = forwardedRequestId;
    res.setHeader('x-request-id', forwardedRequestId);
    res.setHeader('x-correlation-id', forwardedRequestId);
    next();
  });

  // Structured Logging middleware
  app.use((req: RequestWithCorrelation, res: Response, next: NextFunction) => {
    const { method, url, ip } = req;
    const userAgent = req.get('user-agent') || '';
    const startTime = Date.now();

    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;

      logger.log({
        event: 'http_request',
        method,
        url,
        statusCode,
        durationMs: duration,
        ip,
        userAgent,
        requestId: req.requestId,
        correlationId: req.correlationId,
      });
    });
    next();
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());

  const defaultOrigins = ['http://localhost:3000'];
  const envOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : [];
  const frontendOrigin = process.env.FRONTEND_URL?.trim();
  const normalizeOrigin = (origin: string) => origin.replace(/\/+$/, '');
  const allowedOrigins = Array.from(
    new Set([
      ...defaultOrigins.map(normalizeOrigin),
      ...envOrigins.map(normalizeOrigin),
      ...(frontendOrigin ? [normalizeOrigin(frontendOrigin)] : []),
    ]),
  );

  app.enableCors({
    origin: (origin: string | undefined, callback: CorsOriginCallback) => {
      // Allow server-to-server calls, Postman and curl (no Origin header)
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = normalizeOrigin(origin);

      if (
        allowedOrigins.includes(normalizedOrigin) ||
        localDevOriginPattern.test(normalizedOrigin)
      ) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`), false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    allowedHeaders:
      'Content-Type, Accept, Authorization, X-Request-Id, X-Correlation-Id, X-Idempotency-Key, Idempotency-Key',
    credentials: true,
  });
  const port = process.env.PORT ?? 4003;
  // Triggering reload for new routes
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Application is running on: http://localhost:${port}`);
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
