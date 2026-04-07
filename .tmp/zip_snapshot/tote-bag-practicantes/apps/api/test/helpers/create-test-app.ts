import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Request, Response } from 'express';
import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { ModuleMetadata } from '@nestjs/common/interfaces';

export async function createTestApp(metadata: ModuleMetadata) {
  const moduleFixture: TestingModule =
    await Test.createTestingModule(metadata).compile();

  const app = moduleFixture.createNestApplication();

  app.use(
    (
      req: Request & {
        user?: { id: string; email?: string };
      },
      _res: Response,
      next: (error?: unknown) => void,
    ) => {
      const headerValue = req.headers['x-test-user-id'];
      const userId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
      const emailHeaderValue = req.headers['x-test-user-email'];
      const userEmail = Array.isArray(emailHeaderValue)
        ? emailHeaderValue[0]
        : emailHeaderValue;

      if (userId) {
        req.user = {
          id: String(userId),
          ...(userEmail ? { email: String(userEmail) } : {}),
        };
      }

      next();
    },
  );

  app.setGlobalPrefix('api');
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.init();

  return { app, moduleFixture };
}

export async function closeTestApp(app: INestApplication) {
  await app.close();
}

export function getTestServer(
  app: INestApplication,
): Parameters<typeof request>[0] {
  return app.getHttpServer() as Parameters<typeof request>[0];
}
